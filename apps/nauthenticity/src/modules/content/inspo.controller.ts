import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../modules/shared/prisma';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { getDigest, generateOwnedContentSynthesis } from './synthesis.service';

// ---------------------------------------------------------------------------
// Auth middleware — NAU_SERVICE_KEY
// ---------------------------------------------------------------------------
import { authenticate } from '../../utils/auth';

// Default number of owned posts to feed to the synthesis LLM.
// Enough for a representative sample; avoids schema bloat.
const DEFAULT_OWNED_POST_LIMIT = 20;

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------
const InspoCreateSchema = z.object({
  brandId: z.string().min(1),
  postUrl: z.string().url().optional(),
  postId: z.string().optional(),
  note: z.string().optional(),
  type: z.enum(['inspo', 'replicate']),
});

const InspoProcessSchema = z.object({
  extractedHook: z.string().optional(),
  extractedTheme: z.string().optional(),
  adaptedScript: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
export const inspoController: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // 1. Create InspoItem
  // -------------------------------------------------------------------------
  fastify.post('/inspo', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { brandId, postUrl, postId, note, type } = InspoCreateSchema.parse(request.body);

      // Verify brand intelligence record exists
      const brand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) return reply.status(404).send({ error: 'Brand not found' });

      // Resolve post reference
      let resolvedPostId: string | null = postId ?? null;

      if (!resolvedPostId && postUrl) {
        // Try to find existing post by URL
        const existingPost = await prisma.post.findUnique({ where: { url: postUrl } });
        if (existingPost) {
          resolvedPostId = existingPost.id;
        }
        // If post doesn't exist yet, we save without link — it can be scraped later
      }

      const inspoItem = await prisma.inspoItem.create({
        data: {
          brandId,
          postId: resolvedPostId,
          type,
          note: note ?? null,
          status: 'pending',
        },
      });

      logger.info(`[InspoBase] Created ${type} item for brand ${brandId} (ID: ${inspoItem.id})`);
      return reply.status(201).send(inspoItem);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[InspoBase] Error creating inspo item: ${msg}`);
      return reply.status(400).send({ error: msg });
    }
  });

  // -------------------------------------------------------------------------
  // 2. List InspoItems (filterable)
  // -------------------------------------------------------------------------
  fastify.get('/inspo', { preHandler: authenticate }, async (request, reply) => {
    const { brandId, type, status } = request.query as {
      brandId?: string;
      type?: string;
      status?: string;
    };

    const where: Record<string, unknown> = {};
    if (brandId) where.brandId = brandId;
    if (type) where.type = type;
    if (status) where.status = status;

    const items = await prisma.inspoItem.findMany({
      where,
      include: {
        brand: { select: { workspaceId: true } },
        post: { select: { url: true, caption: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(items);
  });

  // -------------------------------------------------------------------------
  // 3. Get single InspoItem
  // -------------------------------------------------------------------------
  fastify.get('/inspo/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await prisma.inspoItem.findUnique({
      where: { id },
      include: {
        brand: { select: { voicePrompt: true } },
        post: {
          include: {
            media: true,
            transcripts: { select: { text: true } },
          },
        },
      },
    });

    if (!item) return reply.status(404).send({ error: 'InspoItem not found' });
    return reply.send(item);
  });

  // -------------------------------------------------------------------------
  // 4. Process InspoItem (AI extraction)
  // -------------------------------------------------------------------------
  fastify.post('/inspo/:id/process', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const item = await prisma.inspoItem.findUnique({
      where: { id },
      include: {
        brand: { select: { voicePrompt: true } },
        post: {
          include: {
            transcripts: { select: { text: true } },
          },
        },
      },
    });

    if (!item) return reply.status(404).send({ error: 'InspoItem not found' });

    // If manual data is provided, use it directly
    const manualData = request.body as Record<string, unknown> | undefined;
    if (manualData) {
      try {
        const parsed = InspoProcessSchema.parse(manualData);
        const updated = await prisma.inspoItem.update({
          where: { id },
          data: {
            ...parsed,
            status: 'processed',
          },
        });
        return reply.send(updated);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ error: msg });
      }
    }

    // Otherwise mark as processed (AI processing deferred to ideation engine in flownau)
    const updated = await prisma.inspoItem.update({
      where: { id },
      data: { status: 'processed' },
    });

    logger.info(`[InspoBase] Processed item ${id}`);
    return reply.send(updated);
  });

  // -------------------------------------------------------------------------
  // 5. Digest — Mechanical InspoBase Synthesis (Phase 11)
  //    Includes ownedContentSynthesis as a fallback when no InspoBase
  //    synthesis (recent/global) exists yet for the brand.
  // -------------------------------------------------------------------------
  fastify.get('/inspo/digest', { preHandler: authenticate }, async (request, reply) => {
    const { brandId } = request.query as { brandId?: string };

    if (!brandId) {
      return reply.status(400).send({ error: 'Missing required query parameter: brandId' });
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return reply.status(404).send({ error: 'Brand not found' });

    try {
      const digest = await getDigest(brandId);

      // Check whether any InspoBase synthesis (recent or global) exists.
      // If not, attach the latest owned_content synthesis as a fallback
      // so that flownau always has some topic context to work with.
      const hasInspoBaseSynthesis = await (prisma as any).brandSynthesis.findFirst({
        where: { brandId, type: { in: ['recent', 'global'] } },
        select: { id: true },
      });

      let ownedContentSynthesis: string | null = null;
      if (!hasInspoBaseSynthesis) {
        const ownedSynthesis = await (prisma as any).brandSynthesis.findFirst({
          where: { brandId, type: 'owned_content' },
          orderBy: { createdAt: 'desc' },
          select: { content: true },
        });
        ownedContentSynthesis = (ownedSynthesis?.content as string) ?? null;
      }

      return reply.send({ ...digest, ownedContentSynthesis });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[InspoDigest] Error generating digest for brand ${brandId}: ${msg}`);
      return reply.status(500).send({ error: `Digest generation failed: ${msg}` });
    }
  });

  // -------------------------------------------------------------------------
  // 5b. Owned Content Synthesis — GET latest (cached)
  //     GET /api/v1/brands/:id/owned-synthesis/latest
  //     Returns the most recent owned_content BrandSynthesis, or null if none.
  //     Used by the dashboard to display the cached synthesis without triggering generation.
  // -------------------------------------------------------------------------
  fastify.get('/brands/:id/owned-synthesis/latest', { preHandler: authenticate }, async (request, reply) => {
    const { id: brandId } = request.params as { id: string };

    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brand) return reply.status(404).send({ error: 'Brand not found' });

    const latest = await (prisma as any).brandSynthesis.findFirst({
      where: { brandId, type: 'owned_content' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true, attachedUrls: true, createdAt: true },
    });

    return reply.send(latest ?? null);
  });

  // -------------------------------------------------------------------------
  // 5c. Owned Content Synthesis — Manual trigger (POST)
  //     POST /api/v1/brands/:id/owned-synthesis
  //     Fetches the brand's owned SocialProfile posts and prompts the LLM in
  //     Spanish to answer "¿De qué trata esta marca?". Persists the result
  //     as a BrandSynthesis of type 'owned_content'.
  // -------------------------------------------------------------------------
  fastify.post('/brands/:id/owned-synthesis', { preHandler: authenticate }, async (request, reply) => {
    const { id: brandId } = request.params as { id: string };

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        voicePrompt: true,
        ownedProfiles: {
          select: { id: true },
        },
      },
    });

    if (!brand) return reply.status(404).send({ error: 'Brand not found' });

    const ownedProfileIds: string[] = brand.ownedProfiles.map((p) => p.id);

    if (ownedProfileIds.length === 0) {
      return reply.status(422).send({
        error: 'No owned social profiles found for this brand. Assign a SocialProfile.ownerId to this brand first.',
      });
    }

    const ownedPosts = await prisma.post.findMany({
      where: { socialProfileId: { in: ownedProfileIds } },
      select: { url: true, caption: true, postedAt: true },
      orderBy: { postedAt: 'desc' },
      take: DEFAULT_OWNED_POST_LIMIT,
    });

    if (ownedPosts.length === 0) {
      return reply.status(422).send({
        error: `No posts found for the brand's owned social profiles. Scrape posts for the owned profiles first.`,
      });
    }

    logger.info(
      `[OwnedSynthesis] Triggering synthesis for brand "${brandId}" using ${ownedPosts.length} owned posts`,
    );

    try {
      const result = await generateOwnedContentSynthesis(
        brandId,
        brand.voicePrompt,
        ownedPosts,
      );

      const saved = await (prisma as any).brandSynthesis.create({
        data: {
          brandId,
          type: 'owned_content',
          content: result.content,
          attachedUrls: result.attachedUrls,
        },
      });

      logger.info(`[OwnedSynthesis] Synthesis created (ID: ${saved.id}) for brand "${brandId}"`);
      return reply.status(201).send({
        id: saved.id,
        content: result.content,
        attachedUrls: result.attachedUrls,
        createdAt: saved.createdAt,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[OwnedSynthesis] Generation failed for brand "${brandId}": ${msg}`);
      return reply.status(500).send({ error: `Owned content synthesis failed: ${msg}` });
    }
  });

  // -------------------------------------------------------------------------
  // 6. Repost — Forward to flownaŭ
  // -------------------------------------------------------------------------
  fastify.post('/repost', { preHandler: authenticate }, async (request, reply) => {
    const { brandId, postUrl } = request.body as { brandId?: string; postUrl?: string };
    if (!brandId || !postUrl) {
      return reply.status(400).send({ error: 'Missing required fields: brandId, postUrl' });
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return reply.status(404).send({ error: 'Brand not found' });

    // Find the post
    const post = await prisma.post.findUnique({
      where: { url: postUrl },
      include: { media: true },
    });

    if (!post) {
      return reply.status(404).send({ error: 'Post not found in database. Scrape it first.' });
    }

    // Forward to flownaŭ content ingest (placeholder — flownau endpoint TBD)
    const flownauUrl = process.env.FLOWNAU_URL || 'http://flownau:3000';

    try {
      const response = await fetch(`${flownauUrl}/api/v1/content/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-nau-service-key': config.nauServiceKey,
        },
        body: JSON.stringify({
          brandId,
          brandName: brandId,
          postUrl,
          media: post.media,
          caption: post.caption,
          type: 'repost',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error(`[InspoBase] Repost forward to flownau failed: ${errText}`);
        return reply.status(502).send({ error: 'Failed to forward to flownaŭ', details: errText });
      }

      logger.info(`[InspoBase] Repost forwarded to flownaŭ for brand ${brandId}`);
      return reply.send({ success: true, message: 'Repost forwarded to flownaŭ' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[InspoBase] Repost error: ${msg}`);
      return reply.status(502).send({ error: `flownaŭ unavailable: ${msg}` });
    }
  });
};
