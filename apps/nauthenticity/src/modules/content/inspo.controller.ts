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
// Create an InspoBase membership. Caller may identify the target by:
//   - postUrl (we resolve to a Post; create a profile-less link only if Post exists)
//   - postId (direct post reference)
//   - socialProfileId (profile-level membership)
const InspoMembershipCreateSchema = z
  .object({
    brandId: z.string().min(1),
    postUrl: z.string().url().optional(),
    postId: z.string().optional(),
    socialProfileId: z.string().optional(),
  })
  .refine(
    (v) => Number(!!v.postUrl) + Number(!!v.postId) + Number(!!v.socialProfileId) === 1,
    { message: 'Provide exactly one of postUrl, postId, or socialProfileId' },
  );

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
export const inspoController: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // 1. Create InspoBase membership
  // -------------------------------------------------------------------------
  fastify.post('/inspo', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { brandId, postUrl, postId, socialProfileId } = InspoMembershipCreateSchema.parse(request.body);

      const brand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) return reply.status(404).send({ error: 'Brand not found' });

      let resolvedPostId: string | null = postId ?? null;
      if (!resolvedPostId && postUrl) {
        const existingPost = await prisma.post.findUnique({ where: { url: postUrl } });
        if (existingPost) {
          resolvedPostId = existingPost.id;
        } else {
          return reply.status(404).send({ error: 'Post not found in database. Scrape it first.' });
        }
      }

      const existing = await prisma.categoryMembership.findFirst({
        where: {
          brandId,
          category: 'INSPO',
          socialProfileId: socialProfileId ?? null,
          postId: resolvedPostId ?? null,
        },
        select: { id: true },
      });
      const membership = existing
        ? await prisma.categoryMembership.update({
            where: { id: existing.id },
            data: { isActive: true },
          })
        : await prisma.categoryMembership.create({
            data: {
              brandId,
              category: 'INSPO',
              socialProfileId: socialProfileId ?? null,
              postId: resolvedPostId,
              isActive: true,
            },
          });

      logger.info(`[InspoBase] Upserted membership for brand ${brandId} (ID: ${membership.id})`);
      return reply.status(201).send(membership);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[InspoBase] Error creating inspo membership: ${msg}`);
      return reply.status(400).send({ error: msg });
    }
  });

  // -------------------------------------------------------------------------
  // 2. List InspoBase memberships
  // -------------------------------------------------------------------------
  fastify.get('/inspo', { preHandler: authenticate }, async (request, reply) => {
    const { brandId } = request.query as { brandId?: string };

    const where: Record<string, unknown> = { category: 'INSPO' };
    if (brandId) where.brandId = brandId;

    const memberships = await prisma.categoryMembership.findMany({
      where,
      include: {
        brand: { select: { workspaceId: true } },
        socialProfile: { select: { id: true, username: true, profileImageUrl: true } },
        post: { select: { id: true, url: true, caption: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(memberships);
  });

  // -------------------------------------------------------------------------
  // 3. Get single InspoBase membership
  // -------------------------------------------------------------------------
  fastify.get('/inspo/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const membership = await prisma.categoryMembership.findUnique({
      where: { id },
      include: {
        brand: { select: { voicePrompt: true } },
        socialProfile: true,
        post: {
          include: {
            media: true,
            transcripts: { select: { text: true } },
          },
        },
      },
    });

    if (!membership || membership.category !== 'INSPO') {
      return reply.status(404).send({ error: 'InspoBase membership not found' });
    }
    return reply.send(membership);
  });

  // -------------------------------------------------------------------------
  // 4. Digest — Mechanical InspoBase Synthesis (Phase 11)
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
  // 4b. Owned Content Synthesis — GET latest (cached)
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
  // 4c. Owned Content Synthesis — Manual trigger (POST)
  // -------------------------------------------------------------------------
  fastify.post('/brands/:id/owned-synthesis', { preHandler: authenticate }, async (request, reply) => {
    const { id: brandId } = request.params as { id: string };

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        voicePrompt: true,
        ownedProfiles: { select: { id: true } },
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
  // 5. Repost — Forward to flownaŭ
  // -------------------------------------------------------------------------
  fastify.post('/repost', { preHandler: authenticate }, async (request, reply) => {
    const { brandId, postUrl } = request.body as { brandId?: string; postUrl?: string };
    if (!brandId || !postUrl) {
      return reply.status(400).send({ error: 'Missing required fields: brandId, postUrl' });
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return reply.status(404).send({ error: 'Brand not found' });

    const post = await prisma.post.findUnique({
      where: { url: postUrl },
      include: { media: true },
    });

    if (!post) {
      return reply.status(404).send({ error: 'Post not found in database. Scrape it first.' });
    }

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
