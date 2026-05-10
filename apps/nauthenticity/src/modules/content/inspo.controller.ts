import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../modules/shared/prisma';
import { logger } from '../../utils/logger';
import { config } from '../../config';

// ---------------------------------------------------------------------------
// Auth middleware — NAU_SERVICE_KEY
// ---------------------------------------------------------------------------
import { authenticate } from '../../utils/auth';

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
  // 4. Repost — Forward to flownaŭ
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
