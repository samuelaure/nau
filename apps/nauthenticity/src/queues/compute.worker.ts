import { Worker, Job } from 'bullmq';

import { config } from '../config';
import { prisma } from '../modules/shared/prisma';
import { logger } from '../utils/logger';
import { wlog } from '../utils/worker-logger';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { transcribeAudio } from '../services/transcription.service';
import {
  extractVideoId,
  fetchYoutubeMetadata,
  fetchTranscriptAutoCaption,
  downloadAudioAndTranscribe,
  DurationLimitExceededError,
} from '../services/youtube-ingest.service';
import { scrapeAndParse } from '../services/blog-ingest.service';
import { logContextStorage } from '../utils/context';
import { computeQueue } from './compute.queue';
import { downloadQueue } from './download.queue';
import { getProfilesInfo } from '../services/apify.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { createStorage, nauthenticity } from 'nau-storage';

// ---------------------------------------------------------------------------
// R2 Client Initialization
// ---------------------------------------------------------------------------
const r2Client =
  config.env.R2_ACCESS_KEY_ID && config.env.R2_SECRET_ACCESS_KEY && config.env.R2_ENDPOINT
    ? new S3Client({
        region: 'auto',
        endpoint: config.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: config.env.R2_ACCESS_KEY_ID,
          secretAccessKey: config.env.R2_SECRET_ACCESS_KEY,
        },
      })
    : null;

const storage = config.env.R2_ENDPOINT && config.env.R2_ACCESS_KEY_ID && config.env.R2_SECRET_ACCESS_KEY && config.env.R2_BUCKET_NAME && config.env.R2_PUBLIC_URL
  ? createStorage({
      endpoint: config.env.R2_ENDPOINT,
      accessKeyId: config.env.R2_ACCESS_KEY_ID,
      secretAccessKey: config.env.R2_SECRET_ACCESS_KEY,
      bucket: config.env.R2_BUCKET_NAME,
      publicUrl: config.env.R2_PUBLIC_URL,
      envPrefix: config.env.NODE_ENV,
    })
  : null;

// ---------------------------------------------------------------------------
// Pipeline Step Registry
// Each step is a named handler. The PIPELINE constant below defines the order.
// To re-sort the pipeline, simply change the order of step names in PIPELINE.
// ---------------------------------------------------------------------------

export type PipelineStepName =
  | 'visualize-batch'
  | 'profile-sync-batch'
  | 'optimize-batch'
  | 'transcribe-batch'
  | 'synthesize-batch'
  | 'embed-batch';

/** Ordered execution sequence. Modify this array to re-sort the pipeline. */
const PIPELINE: PipelineStepName[] = [
  'visualize-batch',
  'profile-sync-batch',
  'optimize-batch',
  'transcribe-batch',
  'synthesize-batch',
  'embed-batch',
];

/** Maps a pipeline step name to the DB phase label used in scrapingRun.phase */
export const PHASE_LABELS: Record<PipelineStepName, string> = {
  'visualize-batch': 'visualizing',
  'profile-sync-batch': 'profiling',
  'optimize-batch': 'optimizing',
  'transcribe-batch': 'transcribing',
  'synthesize-batch': 'synthesizing',
  'embed-batch': 'embedding',
};

/** Returns the next step name in the pipeline, or null if this is the last step. */
function getNextStep(current: PipelineStepName): PipelineStepName | null {
  const idx = PIPELINE.indexOf(current);
  if (idx === -1 || idx === PIPELINE.length - 1) return null;
  return PIPELINE[idx + 1];
}

/** Transitions the run to the next pipeline step, or marks it finished. */
async function advanceOrFinish(
  runId: string,
  username: string,
  current: PipelineStepName,
): Promise<void> {
  const next = getNextStep(current);

  if (next) {
    await prisma.scrapingRun.update({
      where: { id: runId },
      data: { phase: PHASE_LABELS[next] },
    });
    await computeQueue.add(next, { runId, username });
  } else {
    await prisma.scrapingRun.update({
      where: { id: runId },
      data: { phase: 'finished', status: 'completed' },
    });
    await prisma.post.updateMany({
      where: { runId },
      data: { status: 'ready' },
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const atomicMove = (oldPath: string, newPath: string): void => {
  try {
    fs.renameSync(oldPath, newPath);
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'EXDEV') {
      fs.copyFileSync(oldPath, newPath);
      fs.unlinkSync(oldPath);
    } else {
      throw err;
    }
  }
};

const optimizeMedia = async (mediaId: string, filePath: string): Promise<string> => {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error('Media not found');

  const optimizedTempFilePath = path.join(
    config.paths.temp,
    `${mediaId}_opt${media.type === 'video' ? '.mp4' : '.jpg'}`,
  );
  ensureDir(config.paths.temp);

  try {
    if (media.type === 'video') {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(filePath)
          .outputOptions(['-c:v libx264', '-crf 28', '-vf scale=-2:720', '-c:a aac', '-b:a 128k'])
          .save(optimizedTempFilePath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });
    } else {
      // For images, we can do a simple resize/compression if needed,
      // but for now we'll just copy or leave placeholder for future image optimization
      fs.copyFileSync(filePath, optimizedTempFilePath);
    }
    return optimizedTempFilePath;
  } catch (err) {
    if (fs.existsSync(optimizedTempFilePath)) fs.unlinkSync(optimizedTempFilePath);
    throw err;
  }
};

const ensureLocalFile = async (
  storageUrl: string,
  mediaId: string,
): Promise<{ path: string; isTemp: boolean }> => {
  if (storageUrl.startsWith('/content/')) {
    const localPath = path.join(config.paths.storage, storageUrl.replace('/content/', ''));
    if (fs.existsSync(localPath)) {
      return { path: localPath, isTemp: false };
    }
    throw new Error(`Local file not found: ${localPath}`);
  }

  // Handle R2 or other remote URLs
  if (!r2Client || !config.env.R2_BUCKET_NAME) {
    throw new Error('R2 client not configured for remote file download');
  }

  const url = new URL(storageUrl);
  const actualKey = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: config.env.R2_BUCKET_NAME,
      Key: actualKey,
    }),
  );

  const tempPath = path.join(config.paths.temp, `${mediaId}_raw`);
  ensureDir(config.paths.temp);

  const stream = response.Body as Readable;
  const writeStream = fs.createWriteStream(tempPath);
  await new Promise<void>((resolve, reject) => {
    stream.pipe(writeStream).on('finish', () => resolve()).on('error', reject);
  });

  return { path: tempPath, isTemp: true };
};

const generateThumbnail = async (
  mediaId: string,
  filePath: string,
  userDir: string,
  username: string,
  type: string,
): Promise<void> => {
  const thumbFilename = `${mediaId}_thumb.jpg`;
  const thumbPath = path.join(userDir, thumbFilename);
  const thumbPublicUrl = `/content/${username}/posts/${thumbFilename}`;
  let finalThumbUrl = thumbPublicUrl;

  // 1. Generate local thumbnail
  await new Promise<void>((resolve, reject) => {
    const proc = ffmpeg(filePath);
    if (type === 'video') {
      proc
        .screenshots({ timestamps: [1], filename: thumbFilename, folder: userDir, size: '640x?' })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    } else {
      proc
        .size('640x?')
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(thumbPath);
    }
  });

  // 2. Upload to R2 if enabled
  if (storage) {
    const storageKey = nauthenticity.postThumbnail(username, mediaId);
    finalThumbUrl = await storage.upload(storageKey, fs.createReadStream(thumbPath), {
      mimeType: 'image/jpeg',
    });
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  await prisma.media.update({ where: { id: mediaId }, data: { thumbnailUrl: finalThumbUrl } });
  wlog.thumbnail.done(mediaId, finalThumbUrl);
};

const transcribeVideo = async (
  mediaId: string,
  postId: string,
  filePath: string,
): Promise<void> => {
  const audioPath = path.join(config.paths.temp, `${mediaId}.mp3`);
  ensureDir(config.paths.temp);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .toFormat('mp3')
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(audioPath);
    });
    const transcription = await transcribeAudio(audioPath);
    const jsonPayload = transcription as any;
    await prisma.transcript.upsert({
      where: { mediaId },
      update: { text: transcription.text, json: jsonPayload },
      create: {
        postId,
        mediaId,
        text: transcription.text,
        json: jsonPayload,
      },
    });
    wlog.transcribe.done(mediaId, transcription.text.split(' ').length);
  } finally {
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }
};

const createEmbedding = async (text: string, transcriptId: string): Promise<void> => {
  const { getClientForFeature } = await import('@nau/llm-client');
  const { client, model } = getClientForFeature('embedding');

  const result = await client.createEmbedding({
    model,
    input: text.replace(/\n/g, ' '),
  });

  const vectorStr = `[${Array.from(result.embedding).join(',')}]`;

  await prisma.$executeRaw`
    INSERT INTO "Embedding" ("id", "transcriptId", "vector", "model", "createdAt")
    VALUES (
      gen_random_uuid(),
      ${transcriptId},
      ${vectorStr}::vector,
      'text-embedding-3-small',
      NOW()
    )
    ON CONFLICT ("transcriptId") DO UPDATE SET
      "vector" = ${vectorStr}::vector,
      "createdAt" = NOW();
  `;
};

// ---------------------------------------------------------------------------
// Pipeline Step Handlers
// ---------------------------------------------------------------------------

type PauseChecker = (runId: string) => Promise<boolean>;

const handleVisualizeBatch = async (
  job: Job,
  runId: string,
  username: string,
  checkPaused: PauseChecker,
): Promise<{ paused: true } | void> => {
  wlog.phase('visualizing', runId);
  const mediaItems = await prisma.media.findMany({
    where: { post: { runId } },
    include: { post: true },
  });
  const userDir = path.join(config.paths.storage, username, 'posts');
  ensureDir(userDir);

  for (let i = 0; i < mediaItems.length; i++) {
    if (i % 50 === 0) {
      if (await checkPaused(runId)) {
        wlog.phase('paused', runId, 'visualization stopped');
        return { paused: true };
      }
    }
    const m = mediaItems[i];

    if (m.thumbnailUrl) {
      wlog.thumbnail.skip(m.id, 'already exists');
      continue;
    }

    const currentItem = {
      username: m.post.username ?? '',
      postedAt: m.post.postedAt.toISOString().split('T')[0],
      type: m.type,
    };

    await job.updateProgress({
      progress: Math.round((i / mediaItems.length) * 100),
      step: `Thumbnails ${i + 1}/${mediaItems.length}`,
      currentItem,
    });

    try {
      const { path: filePath, isTemp } = await ensureLocalFile(m.storageUrl ?? '', m.id);
      try {
        wlog.thumbnail.start(currentItem.username, m.id, m.type, m.storageUrl ?? '');
        await generateThumbnail(m.id, filePath, userDir, username, m.type);
      } catch (err) {
        wlog.thumbnail.error(m.id, err);
      } finally {
        if (isTemp && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } catch (err) {
      wlog.thumbnail.error(m.id, `ensure local file failed: ${err}`);
    }
  }
};

const handleProfileSyncBatch = async (
  job: Job,
  runId: string,
  username: string,
  checkPaused: PauseChecker,
): Promise<{ paused: true } | void> => {
  wlog.phase('profiling', runId);

  if (await checkPaused(runId)) return { paused: true };

  const usernamesToScrape = new Set<string>();
  const posts = await prisma.post.findMany({
    where: { runId },
    select: { username: true, postedAt: true, collaborators: true },
  });

  for (let i = 0; i < posts.length; i++) {
    if (await checkPaused(runId)) return { paused: true };
    const p = posts[i];

    await job.updateProgress({
      progress: Math.round((i / posts.length) * 100),
      step: `Identifying Collaborators ${i + 1}/${posts.length}`,
      currentItem: {
        username: p.username,
        postedAt: p.postedAt.toISOString().split('T')[0],
        type: 'profile',
      },
    });

    const cs = p.collaborators as { username?: string }[] | null;
    if (Array.isArray(cs)) {
      cs.forEach((c) => {
        if (c.username && c.username !== username) {
          usernamesToScrape.add(c.username);
        }
      });
    }
  }

  const usernamesArray = Array.from(usernamesToScrape);
  if (usernamesArray.length > 0) {
    wlog.profile.start(`(${usernamesArray.length} collaborators)`, '');

    try {
      const profiles = await getProfilesInfo(usernamesArray, async (msg: string) => {
        wlog.ingest.info(msg);
      });

      for (let i = 0; i < profiles.length; i++) {
        if (await checkPaused(runId)) return { paused: true };

        const profile = profiles[i];
        if (!profile || !profile.username) continue;

        await job.updateProgress({
          progress: Math.round((i / profiles.length) * 100),
          step: `Syncing Collaborator ${i + 1}/${profiles.length}`,
          currentItem: { username: profile.username, postedAt: '(collab)', type: 'profile' },
        });

        const imgUrl = profile.profilePicUrlHD || profile.profilePicUrl;

        await downloadQueue.add('process-profile-image', {
          username: profile.username,
          url: imgUrl,
          contextUsername: username,
        });
      }
    } catch (e) {
      wlog.warn(`Failed to sync batch profiles: ${e}`);
    }
  } else {
    wlog.phase('profiling', runId, 'no collaborators found');
  }
};

const handleOptimizeBatch = async (
  job: Job,
  runId: string,
  username: string,
  checkPaused: PauseChecker,
): Promise<{ paused: true } | void> => {
  wlog.phase('optimizing', runId);
  const mediaItems = await prisma.media.findMany({
    where: { post: { runId }, storageUrl: { contains: '/raw/' } },
    include: { post: true },
  });

  if (mediaItems.length === 0) {
    wlog.phase('optimizing', runId, 'no raw media — skipping');
    return;
  }

  for (let i = 0; i < mediaItems.length; i++) {
    // B4: Optimize Pause Check (only check every 50 items)
    if (i % 50 === 0) {
      if (await checkPaused(runId)) {
        wlog.phase('paused', runId, 'optimization stopped');
        return { paused: true };
      }
    }

    const m = mediaItems[i];
    const currentItem = {
      username: m.post.username ?? '',
      postedAt: m.post.postedAt.toISOString().split('T')[0],
      type: m.type,
    };

    await job.updateProgress({
      progress: Math.round((i / mediaItems.length) * 100),
      step: `Optimizing ${i + 1}/${mediaItems.length}`,
      currentItem,
    });

    try {
      const { path: filePath, isTemp } = await ensureLocalFile(m.storageUrl ?? '', m.id);
      try {
        wlog.optimize.start(currentItem.username, m.id, m.type, m.storageUrl ?? '', (m.storageUrl ?? '').replace('/raw/', '/content/'));
        const optimizedPath = await optimizeMedia(m.id, filePath);

        if (m.storageUrl?.startsWith('http') && storage) {
          const ext = path.extname(m.storageUrl).slice(1) || (m.type === 'video' ? 'mp4' : 'jpg');
          const username = m.post.username ?? '';
          const finalKey = nauthenticity.post(username, m.id, ext);
          const rawKey = nauthenticity.rawPost(username, m.id, ext);

          const optimizedUrl = await storage.upload(finalKey, fs.createReadStream(optimizedPath), {
            mimeType: m.type === 'video' ? 'video/mp4' : 'image/jpeg',
          });

          await storage.delete(rawKey).catch(() => {});

          await prisma.media.update({
            where: { id: m.id },
            data: { storageUrl: optimizedUrl },
          });
          wlog.optimize.done(m.id, optimizedUrl);
        } else {
          // If local, overwrite original
          atomicMove(optimizedPath, filePath);
        }

        if (fs.existsSync(optimizedPath)) fs.unlinkSync(optimizedPath);
      } catch (err) {
        wlog.optimize.error(m.id, err);
      } finally {
        if (isTemp && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } catch (err) {
      wlog.optimize.error(m.id, `ensure local file failed: ${err}`);
    }
  }
};

const handleTranscribeBatch = async (
  job: Job,
  runId: string,
  _username: string,
  checkPaused: PauseChecker,
): Promise<{ paused: true } | void> => {
  wlog.phase('transcribing', runId);
  const mediaItems = await prisma.media.findMany({
    where: { post: { runId }, type: 'video' },
    include: { post: true, transcript: true },
  });

  for (let i = 0; i < mediaItems.length; i++) {
    // B4: Optimize Pause Check (only check every 50 items)
    if (i % 50 === 0) {
      if (await checkPaused(runId)) {
        wlog.phase('paused', runId, 'transcription stopped');
        return { paused: true };
      }
    }
    const m = mediaItems[i];

    if (m.transcript) {
      wlog.transcribe.skip(m.id, 'already exists');
      continue;
    }

    const currentItem = {
      username: m.post.username ?? '',
      postedAt: m.post.postedAt.toISOString().split('T')[0],
      type: m.type,
    };

    await job.updateProgress({
      progress: Math.round((i / mediaItems.length) * 100),
      step: `Transcribing ${i + 1}/${mediaItems.length}`,
      currentItem,
    });

    try {
      const { path: filePath, isTemp } = await ensureLocalFile(m.storageUrl ?? '', m.id);
      try {
        wlog.transcribe.start(currentItem.username, m.id, m.storageUrl ?? '');
        await transcribeVideo(m.id, m.postId, filePath);
      } catch (err) {
        wlog.transcribe.error(m.id, err);
      } finally {
        if (isTemp && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } catch (err) {
      wlog.transcribe.error(m.id, `ensure local file failed: ${err}`);
    }
  }
};

// Generates ProfileSynthesis for the first time after a profile's first scrape.
// No-ops if synthesis already exists — subsequent regenerations are manual only.
const triggerFirstProfileSynthesis = async (socialProfileId: string): Promise<void> => {
  const existing = await prisma.profileSynthesis.findUnique({ where: { socialProfileId } });
  if (existing) return;

  const authSecret = config.authSecret;
  if (!authSecret) return;

  const { signServiceToken } = await import('@nau/auth');
  const token = await signServiceToken({ secret: authSecret, iss: 'nauthenticity-worker', aud: 'nauthenticity' });
  const port = config.port ?? 3000;
  await fetch(`http://localhost:${port}/api/v1/social-profiles/${socialProfileId}/synthesis/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
};

const handleSynthesizeBatch = async (
  job: Job,
  runId: string,
  _username: string,
  checkPaused: PauseChecker,
): Promise<{ paused: true } | void> => {
  wlog.phase('synthesizing', runId);

  const posts = await prisma.post.findMany({
    where: { runId, postSynthesis: null },
    select: { id: true, caption: true, socialProfileId: true, transcripts: { select: { text: true }, take: 1 } },
  });

  if (posts.length === 0) return;

  const { getClientForFeature } = await import('@nau/llm-client');
  const { client, model } = getClientForFeature('synthesis');

  // Cache profile ownership per socialProfileId to avoid repeated queries
  const profileOwnerCache = new Map<string, string | null>();
  const getOwnedBrandId = async (socialProfileId: string): Promise<string | null> => {
    if (profileOwnerCache.has(socialProfileId)) return profileOwnerCache.get(socialProfileId)!;
    const profile = await prisma.socialProfile.findUnique({
      where: { id: socialProfileId },
      select: { ownerId: true },
    });
    const ownerId = profile?.ownerId ?? null;
    profileOwnerCache.set(socialProfileId, ownerId);
    return ownerId;
  };

  for (let i = 0; i < posts.length; i++) {
    if (i % 20 === 0 && await checkPaused(runId)) {
      wlog.phase('paused', runId, 'synthesis stopped');
      return { paused: true };
    }

    await job.updateProgress({
      progress: Math.round((i / posts.length) * 100),
      step: `Synthesizing ${i + 1}/${posts.length}`,
      currentItem: { type: 'synthesis' },
    });

    const post = posts[i];
    const caption = post.caption ?? '';
    const transcript = post.transcripts[0]?.text ?? '';

    if (!caption && !transcript) continue;

    const contentBlock = [
      caption && `Caption: ${caption}`,
      transcript && `Transcript: ${transcript}`,
    ].filter(Boolean).join('\n');

    // Collect all brands that need source concepts for this post
    const [inspoMemberships, ownedBrandId] = await Promise.all([
      prisma.categoryMembership.findMany({
        where: { postId: post.id, category: 'INSPO', isActive: true, brandId: { not: null } },
        select: { brandId: true },
      }),
      post.socialProfileId ? getOwnedBrandId(post.socialProfileId) : Promise.resolve(null),
    ]);

    const sourceBrandIds = new Set<string>();
    for (const m of inspoMemberships) if (m.brandId) sourceBrandIds.add(m.brandId);
    if (ownedBrandId) sourceBrandIds.add(ownedBrandId);

    const needsSourceConcepts = sourceBrandIds.size > 0;

    // Determine language from first applicable brand
    const firstBrandId = sourceBrandIds.values().next().value ?? null;
    const brandLanguage = firstBrandId
      ? (await prisma.brand.findUnique({ where: { id: firstBrandId }, select: { language: true } }))?.language ?? 'Spanish'
      : 'Spanish';

    try {
      if (needsSourceConcepts) {
        const result = await client.chatCompletion({
          model,
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content: `You extract reusable content intelligence from social media posts. Your output will be used by other content teams as raw inspiration material — not to describe the original post or its author.

Produce two things:

1. "synthesis": a tight 1-3 sentence distillation of the core idea or argument in the post. Write the idea itself, not a description of it. Never mention the author, their account, their products, their prices, or any offer. Ignore promotional or sales content entirely — extract only the underlying idea or perspective being expressed.

2. "sourceConcepts": 1-3 distinct content angles (30-60 words each) derived from the post's ideas that any brand could use as a starting point for their own content. Each concept must stand on its own without reference to the original author or their business. Exclude anything tied to personal branding, service offers, pricing, or calls to action. Focus on the argument, the insight, the frame, or the point of view.

Write all output in ${brandLanguage}.

Return only valid JSON: { "synthesis": "...", "sourceConcepts": ["...", "..."] }`,
            },
            { role: 'user', content: contentBlock },
          ],
          responseFormat: { type: 'json_object' },
        });

        let synthesis: string;
        let sourceConcepts: string[] = [];

        try {
          const parsed = JSON.parse(result.content) as { synthesis?: string; sourceConcepts?: unknown[] };
          synthesis = typeof parsed.synthesis === 'string' ? parsed.synthesis.trim() : result.content.trim();
          sourceConcepts = Array.isArray(parsed.sourceConcepts)
            ? parsed.sourceConcepts.filter((c): c is string => typeof c === 'string')
            : [];
        } catch {
          synthesis = result.content.trim();
        }

        await prisma.post.update({ where: { id: post.id }, data: { postSynthesis: synthesis } });

        if (sourceConcepts.length > 0) {
          await Promise.all(
            [...sourceBrandIds].flatMap((brandId) =>
              sourceConcepts.map(async (content) => {
                const concept = await prisma.sourceConcept.create({
                  data: { brandId, content, sourceType: 'specific_post', status: 'pending' },
                });
                await prisma.sourceConceptSource.create({
                  data: { sourceConceptId: concept.id, postId: post.id },
                });
              }),
            ),
          );
        }
      } else {
        const result = await client.chatCompletion({
          model,
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: `You extract the core idea from a social media post in 1-3 sentences. Write the idea itself — not a description of it. Never mention the author, their products, their offers, or their prices. Ignore promotional or sales content. If the post is purely an offer or call to action with no underlying idea, return a single dash: -\n\nWrite all output in ${brandLanguage}.`,
            },
            { role: 'user', content: contentBlock },
          ],
        });

        await prisma.post.update({
          where: { id: post.id },
          data: { postSynthesis: result.content.trim() },
        });
      }
    } catch (err) {
      logger.error({ postId: post.id, err }, '[SYNTHESIZE] Failed to synthesize post');
    }
  }

  // After all posts processed: trigger first-time ProfileSynthesis for each profile in this run
  const profileIds = [...new Set(posts.map((p) => p.socialProfileId).filter(Boolean))] as string[];
  for (const socialProfileId of profileIds) {
    triggerFirstProfileSynthesis(socialProfileId).catch(() => {});
  }
};

const handleEmbedBatch = async (
  job: Job,
  runId: string,
  _username: string,
  checkPaused: PauseChecker,
): Promise<{ paused: true } | void> => {
  wlog.phase('embedding', runId);
  const transcripts = await prisma.transcript.findMany({
    where: { post: { runId }, knowledgeChunks: { none: {} } },
    include: { post: true },
  });

  for (let i = 0; i < transcripts.length; i++) {
    if (i % 50 === 0) {
      if (await checkPaused(runId)) {
        wlog.phase('paused', runId, 'embedding stopped');
        return { paused: true };
      }
    }
    const t = transcripts[i];

    await job.updateProgress({
      progress: Math.round((i / transcripts.length) * 100),
      step: `Embedding ${i + 1}/${transcripts.length}`,
      currentItem: {
        username: t.post.username ?? 'unknown',
        postedAt: t.post.postedAt.toISOString().split('T')[0],
        type: 'embedding',
      },
    });

    try {
      wlog.embed.start(t.id);
      await createEmbedding(t.text, t.id);
      wlog.embed.done(t.id);
    } catch (e) {
      wlog.embed.error(t.id, e);
    }
  }
};

// ---------------------------------------------------------------------------
// Standalone Job Handlers (not part of the scraping pipeline)
// ---------------------------------------------------------------------------

const handleYoutubeIngest = async (job: Job): Promise<void> => {
  const { youtubeVideoId } = job.data as { youtubeVideoId: string };

  await prisma.youtubeVideo.update({ where: { id: youtubeVideoId }, data: { status: 'processing' } });

  const video = await prisma.youtubeVideo.findUnique({ where: { id: youtubeVideoId } });
  if (!video) throw new Error(`YoutubeVideo ${youtubeVideoId} not found`);

  const { getClientForFeature } = await import('@nau/llm-client');
  const { client, model } = getClientForFeature('synthesis');

  const brandLanguage = (await prisma.brand.findUnique({ where: { id: video.brandId }, select: { language: true } }))?.language ?? 'Spanish';

  try {
    let transcript: string;

    try {
      transcript = await fetchTranscriptAutoCaption(video.videoId);
    } catch (captionErr) {
      logger.warn({ youtubeVideoId, captionErr }, 'auto-caption failed, falling back to audio download');
      const durationSeconds = video.durationSeconds ?? 0;
      transcript = await downloadAudioAndTranscribe(video.videoId, durationSeconds);
    }

    const result = await client.chatCompletion({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a content analyst. Analyse the provided YouTube video transcript and write a concise, objective synthesis capturing its core topic, angle, tone, and distinctive qualities. Use as many sentences as needed to represent the content faithfully. Be direct and specific.\n\nWrite all output in ${brandLanguage}.`,
        },
        { role: 'user', content: transcript },
      ],
    });

    await prisma.youtubeVideo.update({
      where: { id: youtubeVideoId },
      data: { transcript, synthesis: result.content.trim(), status: 'ready' },
    });
  } catch (err) {
    if (err instanceof DurationLimitExceededError) {
      await prisma.youtubeVideo.update({
        where: { id: youtubeVideoId },
        data: { status: 'failed', failureReason: 'duration_limit_exceeded' },
      });
      await prisma.brand.update({
        where: { id: video.brandId },
        data: { youtubeDurationExceededCount: { increment: 1 } },
      });
      return;
    }
    const failureReason = err instanceof Error ? err.message : String(err);
    await prisma.youtubeVideo.update({
      where: { id: youtubeVideoId },
      data: { status: 'failed', failureReason },
    });
    throw err;
  }
};

const handleBlogIngest = async (job: Job): Promise<void> => {
  const { blogPostId } = job.data as { blogPostId: string };

  await prisma.blogPost.update({ where: { id: blogPostId }, data: { status: 'processing' } });

  const post = await prisma.blogPost.findUnique({ where: { id: blogPostId } });
  if (!post) throw new Error(`BlogPost ${blogPostId} not found`);

  const { getClientForFeature } = await import('@nau/llm-client');
  const { client, model } = getClientForFeature('synthesis');

  const brandLanguage = (await prisma.brand.findUnique({ where: { id: post.brandId }, select: { language: true } }))?.language ?? 'Spanish';

  try {
    const article = await scrapeAndParse(post.url);

    const result = await client.chatCompletion({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a content analyst. Analyse the provided blog post and write a concise, objective synthesis capturing its core topic, angle, tone, and distinctive qualities. Use as many sentences as needed. Be direct and specific.\n\nWrite all output in ${brandLanguage}.`,
        },
        { role: 'user', content: `Title: ${article.title ?? 'Unknown'}\n\n${article.rawText}` },
      ],
    });

    await prisma.blogPost.update({
      where: { id: blogPostId },
      data: {
        title: article.title,
        author: article.author,
        publishedAt: article.publishedAt,
        rawText: article.rawText,
        synthesis: result.content.trim(),
        status: 'ready',
      },
    });
  } catch (err) {
    const failureReason = err instanceof Error ? err.message : String(err);
    await prisma.blogPost.update({
      where: { id: blogPostId },
      data: { status: 'failed', failureReason },
    });
    throw err;
  }
};

/** Dispatch table mapping each step name to its handler. */
const STEP_HANDLERS: Record<
  PipelineStepName,
  (
    job: Job,
    runId: string,
    username: string,
    checkPaused: PauseChecker,
  ) => Promise<{ paused: true } | void>
> = {
  'visualize-batch': handleVisualizeBatch,
  'profile-sync-batch': handleProfileSyncBatch,
  'optimize-batch': handleOptimizeBatch,
  'transcribe-batch': handleTranscribeBatch,
  'synthesize-batch': handleSynthesizeBatch,
  'embed-batch': handleEmbedBatch,
};

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export const computeWorker = new Worker(
  'compute-queue',
  async (job: Job) => {
    return logContextStorage.run({ jobId: job.id, ...job.data }, async () => {
      if (process.env.PAUSE_COMPUTE === 'true') {
        throw new Error('Compute is paused');
      }

      const checkPaused: PauseChecker = async (runId: string) => {
        const run = await prisma.scrapingRun.findUnique({ where: { id: runId } });
        return run?.isPaused ?? false;
      };

      // Standalone jobs (not part of the scraping pipeline)
      if (job.name === 'youtube-ingest') return handleYoutubeIngest(job);
      if (job.name === 'blog-ingest') return handleBlogIngest(job);

      const stepName = job.name as PipelineStepName;
      const handler = STEP_HANDLERS[stepName];

      if (!handler) {
        wlog.warn(`Unknown job name: "${job.name}". Skipping.`);
        return;
      }

      const { runId, username } = job.data as { runId: string; username: string };

      const result = await handler(job, runId, username, checkPaused);
      if (result?.paused) return result;

      if (await checkPaused(runId)) return { paused: true };

      await advanceOrFinish(runId, username, stepName);
    });
  },
  { connection: config.redis, concurrency: 1 }, // Compute intensive, set concurrency to 1
);

computeWorker.on('failed', (job, err) => {
  wlog.warn(`Compute job ${job?.id} failed: ${err.message}`);
});
