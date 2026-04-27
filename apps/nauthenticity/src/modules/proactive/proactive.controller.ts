import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../modules/shared/prisma';
import { logger } from '../../utils/logger';
import { runProactiveFanout } from './fanout.processor';
import { generateReactiveComments } from './reactive.service';
import axios from 'axios';

// ---------------------------------------------------------------------------
// Auth middleware — NAU_SERVICE_KEY (inter-service)
// ---------------------------------------------------------------------------

import { authenticate } from '../../utils/auth';

// ---------------------------------------------------------------------------
// Zod Schemas — intelligence-only fields (structural fields removed)
// ---------------------------------------------------------------------------

const BrandUpsertSchema = z.object({
  workspaceId: z.string().min(1),
  mainUsername: z.string().optional().nullable(),
  voicePrompt: z.string().min(1),
  commentStrategy: z.string().optional().nullable(),
  suggestionsCount: z.number().int().min(1).max(10).default(3),
  windowStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  windowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
});

const MonitoringTypeEnum = z.enum(['content', 'benchmark', 'inspiration']);

const MonitorCreateSchema = z.object({
  brandId: z.string().min(1),
  usernames: z.array(z.string().min(1)),
  monitoringType: MonitoringTypeEnum.default('content'),
  isActive: z.boolean().default(true),
  settings: z.record(z.any()).optional().nullable(),
});

const MonitorUpdateSchema = z.object({
  monitoringType: MonitoringTypeEnum.optional(),
  isActive: z.boolean().optional(),
  settings: z.record(z.any()).optional().nullable(),
});

const FeedbackSchema = z.object({
  commentText: z.string().min(1),
  brandId: z.string().min(1),
  sourcePostId: z.string().min(1),
  isSelected: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export const proactiveController: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // 1. Reactive trigger
  // -------------------------------------------------------------------------
  fastify.post('/generate-comment', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { targetUrl, brandId } = request.body as { targetUrl?: string; brandId?: string };
      if (!targetUrl || !brandId) throw new Error('Missing required fields: targetUrl and brandId');

      const brand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) return reply.status(404).send({ error: 'Brand not found' });

      const suggestions = await generateReactiveComments(targetUrl, brandId);

      return reply.send({ success: true, suggestions });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[Proactive] Error in generate-comment: ${msg}`);
      return reply.status(400).send({ error: msg });
    }
  });

  // -------------------------------------------------------------------------
  // 2. Comment feedback
  // -------------------------------------------------------------------------
  fastify.post('/comment-feedback', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { commentText, brandId, sourcePostId, isSelected } = FeedbackSchema.parse(request.body);

      await prisma.commentFeedback.create({
        data: { brandId, postId: sourcePostId, commentText, isSelected },
      });

      return reply.send({ success: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(400).send({ error: msg });
    }
  });

  // -------------------------------------------------------------------------
  // 3. Manual fanout trigger
  // -------------------------------------------------------------------------
  fastify.post('/trigger-fanout', { preHandler: authenticate }, async (_request, reply) => {
    logger.info(`[Proactive] Manual fanout trigger received.`);
    runProactiveFanout().catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[FanoutProcessor] Unhandled error: ${msg}`);
    });
    return reply.send({ success: true, message: 'Fanout initiated in background.' });
  });

  // -------------------------------------------------------------------------
  // 4. BrandIntelligence — upsert and fetch (structural Brand CRUD removed)
  // Brand identity (name, timezone, workspaceId, isActive) is managed by 9naŭ.
  // -------------------------------------------------------------------------

  fastify.get(
    '/brands/:brandId/intelligence',
    { preHandler: authenticate },
    async (request, reply) => {
      const { brandId } = request.params as { brandId: string };
      const intelligence = await prisma.brand.findUnique({
        where: { id: brandId },
        include: {
          monitors: {
            select: {
              id: true,
              socialProfile: { select: { username: true } },
              monitoringType: true,
              isActive: true,
              settings: true,
              createdAt: true,
            },
          },
        },
      });
      if (!intelligence) return reply.status(404).send({ error: 'Brand intelligence not found' });
      return reply.send(intelligence);
    },
  );

  fastify.put(
    '/brands/:brandId/intelligence',
    { preHandler: authenticate },
    async (request, reply) => {
      const { brandId } = request.params as { brandId: string };
      try {
        const data = BrandUpsertSchema.parse(request.body);
        const intelligence = await prisma.brand.upsert({
          where: { id: brandId },
          create: { id: brandId, ...data },
          update: data,
        });
        return reply.send(intelligence);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ error: msg });
      }
    },
  );

  // Partial update — only update provided fields (no voicePrompt required)
  // Uses upsert so it also works for brands with no intelligence record yet
  fastify.patch(
    '/brands/:brandId/intelligence',
    { preHandler: authenticate },
    async (request, reply) => {
      const { brandId } = request.params as { brandId: string };
      try {
        const body = request.body as Record<string, unknown>;
        const allowed = ['workspaceId', 'mainUsername', 'voicePrompt', 'commentStrategy', 'suggestionsCount', 'windowStart', 'windowEnd', 'timezone'];
        const patch: Record<string, unknown> = {};
        for (const key of allowed) {
          if (key in body) patch[key] = body[key];
        }
        const intelligence = await prisma.brand.upsert({
          where: { id: brandId },
          update: patch,
          create: { id: brandId, workspaceId: (patch.workspaceId as string) ?? '', voicePrompt: (patch.voicePrompt as string) ?? '', ...patch },
        });
        return reply.send(intelligence);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ error: msg });
      }
    },
  );

  // -------------------------------------------------------------------------
  // 5. Brand DNA endpoints — intelligence-only
  // -------------------------------------------------------------------------

  // Full DNA — for ideation / composition (high-token)
  fastify.get('/brands/:brandId/dna', { preHandler: authenticate }, async (request, reply) => {
    const { brandId } = request.params as { brandId: string };
    const intelligence = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        monitors: { select: { socialProfile: { select: { username: true } }, settings: true } },
        syntheses: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!intelligence) return reply.status(404).send({ error: 'Brand intelligence not found' });

    return reply.send({
      brandId: intelligence.id,
      voicePrompt: intelligence.voicePrompt,
      commentStrategy: intelligence.commentStrategy,
      suggestionsCount: intelligence.suggestionsCount,
      targets: intelligence.monitors,
      latestSynthesis: intelligence.syntheses[0] ?? null,
    });
  });

  // Ultra-light DNA — for triage routing / comment suggestion (low-token)
  fastify.get(
    '/brands/:brandId/dna-light',
    { preHandler: authenticate },
    async (request, reply) => {
      const { brandId } = request.params as { brandId: string };
      const intelligence = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, voicePrompt: true },
      });
      if (!intelligence) return reply.status(404).send({ error: 'Brand intelligence not found' });

      return reply.send({
        brandId: intelligence.id,
        voicePrompt: intelligence.voicePrompt.slice(0, 500),
      });
    },
  );

  // -------------------------------------------------------------------------
  // 5b. Service-to-Service structural sync and discovery
  // -------------------------------------------------------------------------

  /**
   * List all brands in a workspace with their minimal intelligence DNA.
   * Used by 9naŭ Triage for routing.
   */
  fastify.get('/service/brands', { preHandler: authenticate }, async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId?: string };
    if (!workspaceId) return reply.status(400).send({ error: 'Missing workspaceId' });

    const brands = await prisma.brand.findMany({
      where: { workspaceId },
      include: {
        monitors: {
          select: {
            socialProfile: { select: { username: true } },
            settings: true,
            monitoringType: true,
          },
        },
      },
    });

    return reply.send(brands);
  });

  /**
   * Sync structural changes (like workspaceId) from 9naŭ master.
   */
  fastify.patch(
    '/service/brands/:brandId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { brandId } = request.params as { brandId: string };
      const schema = z.object({
        workspaceId: z.string().optional(),
        mainUsername: z.string().optional(),
      });

      try {
        const data = schema.parse(request.body);
        const updated = await prisma.brand.update({
          where: { id: brandId },
          data,
        });
        return reply.send(updated);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ error: msg });
      }
    },
  );

  // -------------------------------------------------------------------------
  // 6. Targets — Create / Update / Delete
  // -------------------------------------------------------------------------
  fastify.post('/targets', { preHandler: authenticate }, async (request, reply) => {
    try {
      const {
        brandId,
        usernames,
        monitoringType,
        isActive,
        settings,
      } = MonitorCreateSchema.parse(request.body);

      for (const username of usernames) {
        const profile = await prisma.socialProfile.upsert({
          where: { platform_username: { platform: 'instagram', username } },
          create: { platform: 'instagram', username },
          update: {},
        });

        await prisma.socialProfileMonitor.upsert({
          where: { brandId_socialProfileId: { brandId, socialProfileId: profile.id } },
          create: {
            brandId,
            socialProfileId: profile.id,
            monitoringType,
            isActive,
            settings: settings ?? null,
          },
          update: {
            monitoringType,
            isActive,
            settings: settings !== undefined ? settings : undefined,
          },
        });
      }

      return reply.send({ success: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(400).send({ error: msg });
    }
  });

  fastify.put(
    '/targets/:brandId/:username',
    { preHandler: authenticate },
    async (request, reply) => {
      const { brandId, username } = request.params as { brandId: string; username: string };
      try {
        const data = MonitorUpdateSchema.parse(request.body);
        const profile = await prisma.socialProfile.findUnique({
          where: { platform_username: { platform: 'instagram', username } },
        });
        if (!profile) return reply.status(404).send({ error: 'SocialProfile not found' });
        const target = await prisma.socialProfileMonitor.update({
          where: { brandId_socialProfileId: { brandId, socialProfileId: profile.id } },
          data,
        });
        return reply.send(target);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ error: msg });
      }
    },
  );

  fastify.delete('/targets', { preHandler: authenticate }, async (request, reply) => {
    const { brandId, username } = request.query as { brandId: string; username: string };
    if (!brandId || !username) {
      return reply.status(400).send({ error: 'Missing required query params: brandId, username' });
    }
    const profile = await prisma.socialProfile.findUnique({
      where: { platform_username: { platform: 'instagram', username } },
    });
    if (!profile) return reply.status(404).send({ error: 'SocialProfile not found' });
    await prisma.socialProfileMonitor.delete({
      where: { brandId_socialProfileId: { brandId, socialProfileId: profile.id } },
    });
    return reply.send({ success: true });
  });

  // -------------------------------------------------------------------------
  // 7. Sync owned profiles to flownau
  // -------------------------------------------------------------------------
  fastify.post(
    '/brands/:brandId/sync-owned-to-flownau',
    { preHandler: authenticate },
    async (request, reply) => {
      const { brandId } = request.params as { brandId: string };
      try {
        const brand = await prisma.brand.findUnique({ where: { id: brandId } });
        if (!brand) return reply.status(404).send({ error: 'Brand not found' });

        const profiles = await prisma.socialProfile.findMany({
          where: { ownerId: brandId },
        });

        if (profiles.length === 0) {
          return reply.send({
            success: true,
            synced: 0,
            message: 'No owned profiles to sync',
          });
        }

        const flownauUrl = process.env.FLOWNAU_URL || 'http://localhost:3003';
        const serviceKey = process.env.NAU_SERVICE_KEY || '';

        let synced = 0;
        const errors: Array<{ username: string; error: string }> = [];

        for (const profile of profiles) {
          try {
            const response = await axios.post(
              `${flownauUrl}/api/brands/${brandId}/social-profiles`,
              {
                username: profile.username,
                platform: profile.platform,
                profileImageUrl: profile.profileImageUrl,
                nauthenticityProfileId: profile.id,
                syncedFromNauthenticity: true,
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Nau-Service-Key': serviceKey,
                },
                timeout: 10_000,
              },
            );

            if (response.status === 201 || response.status === 200) {
              synced++;
              logger.log(
                `[SyncToFlownau] Synced profile ${profile.username} (${profile.platform}) for brand ${brandId}`,
              );
            }
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            errors.push({ username: profile.username, error: msg });
            logger.error(
              `[SyncToFlownau] Failed to sync profile ${profile.username}: ${msg}`,
            );
          }
        }

        return reply.send({
          success: synced > 0,
          synced,
          total: profiles.length,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(500).send({ error: msg });
      }
    },
  );
};
