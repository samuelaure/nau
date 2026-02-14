import { Request, Response, Router } from 'express';
import { logger } from '../core/logger.js';
import { db } from '../core/db.js';
import { MetricsService } from '../services/metrics.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { Orchestrator } from '../core/orchestrator.js';
import { EventsService } from '../services/events.service.js';
import { asyncHandler } from '../core/errors/asyncHandler.js';
import { NotFoundError } from '../core/errors/AppError.js';

const router = Router();

/**
 * REAL-TIME EVENTS (SSE)
 */
router.get('/events', (req: Request, res: Response) => {
  const clientId = Date.now().toString();
  EventsService.addClient(clientId, res);
});

/**
 * Get overall metrics for all campaigns
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const campaigns = await db.campaign.findMany({ where: { isActive: true } });
    const stats = await Promise.all(
      campaigns.map(async (c) => ({
        campaignId: c.id,
        name: c.name,
        metrics: await MetricsService.getCampaignMetrics(c.id),
      }))
    );
    res.json(stats);
  })
);

/**
 * Get overall metrics for the current tenant
 */
router.get(
  '/tenant-stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = (req as any).user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in request context' });
    }
    const metrics = await MetricsService.getTenantMetrics(tenantId);
    res.json(metrics);
  })
);

/**
 * Get all leads with their current status and tags
 */
router.get(
  '/leads',
  asyncHandler(async (req: Request, res: Response) => {
    const { campaignId, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10))); // Cap at 100
    const skip = (pageNum - 1) * limitNum;

    const where = campaignId ? { campaignId: campaignId as string } : {};

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        include: {
          tags: true,
          currentStage: true,
        },
        orderBy: { lastInteraction: 'desc' },
        skip,
        take: limitNum,
      }),
      db.lead.count({ where }),
    ]);

    res.json({
      data: leads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

/**
 * Resolve human handover
 */
router.post(
  '/leads/:id/resolve',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await db.lead.update({
      where: { id: id as string },
      data: { status: 'ACTIVE' },
    });
    res.json({ success: true });
  })
);

/**
 * Global Configuration (Availability Status)
 */
router.get(
  '/config/global',
  asyncHandler(async (req: Request, res: Response) => {
    let config = await db.globalConfig.findUnique({ where: { id: 'singleton' } });
    if (!config) {
      config = await db.globalConfig.create({
        data: {
          id: 'singleton',
          availabilityStatus: 'disponible',
          tenant: { connect: { id: (req as any).user.tenantId } },
        },
      });
    }
    res.json({
      ...(config as any),
      metaAppId: (process.env.META_APP_ID && process.env.META_APP_SECRET) ? process.env.META_APP_ID : null,
    });
  })
);

router.post(
  '/config/global',
  asyncHandler(async (req: Request, res: Response) => {
    const { availabilityStatus } = req.body;
    const config = await db.globalConfig.upsert({
      where: { id: 'singleton' },
      update: { availabilityStatus },
      create: {
        id: 'singleton',
        availabilityStatus,
        tenant: { connect: { id: (req as any).user.tenantId } },
      },
    });
    res.json(config);
  })
);

/**
 * Keywords for Human Takeover
 */
router.get(
  '/config/keywords',
  asyncHandler(async (req: Request, res: Response) => {
    const keywords = await db.takeoverKeyword.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(keywords);
  })
);

router.post(
  '/config/keywords',
  asyncHandler(async (req: Request, res: Response) => {
    const { word, type } = req.body;
    const keyword = await db.takeoverKeyword.create({
      data: {
        word: word.toUpperCase().trim(),
        type: type || 'INTERNAL',
        tenant: { connect: { id: (req as any).user.tenantId } },
      },
    });
    res.json(keyword);
  })
);

/**
 * LIVE CHAT ENDPOINTS
 */
router.get(
  '/leads/:id/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const messages = await db.message.findMany({
      where: { leadId: id as string },
      orderBy: { timestamp: 'asc' },
    });
    res.json(messages);
  })
);

router.post(
  '/leads/:id/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;
    const lead = await db.lead.findUnique({
      where: { id: id as string },
      include: { campaign: { include: { whatsAppConfig: true } } },
    });
    if (!lead) throw new NotFoundError('Lead not found');

    // Send via WhatsApp (use campaign context)
    const waRes = await WhatsAppService.sendText(lead.tenantId, lead.phoneNumber, content, lead.campaignId);
    const whatsappId = waRes?.messages?.[0]?.id;

    // Resolve phoneNumberId for Orchestrator context
    let phoneNumberId = lead.campaign?.whatsAppConfig?.phoneNumberId;
    if (!phoneNumberId) {
      const defaultConfig = await db.whatsAppConfig.findFirst({
        where: { tenantId: lead.tenantId, isDefault: true },
      });
      phoneNumberId = defaultConfig?.phoneNumberId;
    }

    // Process as OUTBOUND via Orchestrator to ensure consistency
    await Orchestrator.handleIncoming(
      lead.phoneNumber,
      content,
      undefined,
      'OUTBOUND',
      whatsappId,
      phoneNumberId
    );

    res.json({ success: true, whatsappId });
  })
);

/**
 * BUSINESS & AGENT CONFIG
 */
router.get(
  '/config/business',
  asyncHandler(async (req: Request, res: Response) => {
    const business = await (db as any).businessProfile.findUnique({ where: { id: 'singleton' } });
    res.json(business || { name: 'whatsnaŭ', knowledgeBase: '' });
  })
);

router.post(
  '/config/business',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, knowledgeBase } = req.body;
    const business = await (db as any).businessProfile.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        name,
        knowledgeBase,
        tenant: { connect: { id: (req as any).user.tenantId } },
      },
      update: { name, knowledgeBase },
    });
    res.json(business);
  })
);

router.get(
  '/config/prompts',
  asyncHandler(async (req: Request, res: Response) => {
    const { campaignId } = req.query;
    const where = campaignId ? { campaignId: campaignId as string } : {};
    const prompts = await (db as any).promptConfig.findMany({ where });
    res.json(prompts);
  })
);

router.post(
  '/config/prompts',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, basePrompt, campaignId } = req.body;
    if (!campaignId) return res.status(400).json({ error: 'campaignId is required' });

    const prompt = await (db as any).promptConfig.upsert({
      where: { role_campaignId: { role, campaignId } },
      create: { role, basePrompt, campaignId },
      update: { basePrompt },
    });
    res.json(prompt);
  })
);

router.get(
  '/config/sequences',
  asyncHandler(async (req: Request, res: Response) => {
    const { campaignId } = req.query;
    const where = campaignId ? { campaignId: campaignId as string } : {};
    const stages = await db.campaignStage.findMany({
      where,
      orderBy: { order: 'asc' },
    });
    res.json(stages);
  })
);

router.post(
  '/config/sequences/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, waitHours } = req.body;
    const stage = await db.campaignStage.update({
      where: { id: id as string },
      data: { name, waitHours: Number(waitHours) },
    });
    res.json(stage);
  })
);

router.post(
  '/leads/:id/ai-toggle',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { aiEnabled } = req.body;
    const lead = await (db as any).lead.update({
      where: { id: id as string },
      data: { aiEnabled },
    });
    res.json(lead);
  })
);

router.get(
  '/config/whatsapp-templates',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const templates = await WhatsAppService.getTemplates(tenantId);
      res.json(templates);
    } catch (error) {
      logger.warn({ error }, 'Could not fetch templates (likely WhatsApp not yet configured)');
      res.json({ data: [] });
    }
  })
);

router.post(
  '/config/whatsapp-templates',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, category, language, components } = req.body;
    const tenantId = (req as any).user.tenantId;
    const result = await WhatsAppService.createTemplate(tenantId, name, category, language, components);
    res.json(result);
  })
);

router.post(
  '/config/whatsapp-templates/sync',
  asyncHandler(async (req: Request, res: Response) => {
    const { TemplateSyncService } = await import('../services/template-sync.service.js');
    const tenantId = (req as any).user.tenantId;
    const result = await TemplateSyncService.syncTemplatesFromMeta(tenantId);
    res.json(result);
  })
);

router.post(
  '/config/whatsapp-templates/link',
  asyncHandler(async (req: Request, res: Response) => {
    const { TemplateSyncService } = await import('../services/template-sync.service.js');
    const { metaTemplateName, messageTemplateId, variableMapping } = req.body;

    // First find the local WhatsAppTemplate by Meta name
    const waTemplate = await (db as any).whatsAppTemplate.findUnique({
      where: { name: metaTemplateName },
    });

    if (!waTemplate) {
      return res
        .status(404)
        .json({ error: 'WhatsApp Template not found in local db. Sync first.' });
    }

    await TemplateSyncService.linkTemplateToMessage(
      waTemplate.id,
      messageTemplateId,
      variableMapping
    );

    res.json({ success: true });
  })
);

router.get(
  '/config/telegram',
  asyncHandler(async (req: Request, res: Response) => {
    const config = await (db as any).telegramConfig.findUnique({ where: { id: 'singleton' } });
    res.json(config || { botToken: '', chatId: '', isEnabled: false });
  })
);

router.post(
  '/config/telegram',
  asyncHandler(async (req: Request, res: Response) => {
    const { botToken, chatId, isEnabled } = req.body;
    const config = await (db as any).telegramConfig.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        botToken,
        chatId,
        isEnabled,
        tenant: { connect: { id: (req as any).user.tenantId } },
      },
      update: { botToken, chatId, isEnabled },
    });
    res.json(config);
  })
);

router.delete(
  '/config/keywords/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await db.takeoverKeyword.delete({
      where: { id: id as string },
    });
    res.json({ success: true });
  })
);

/**
 * CAMPAIGN MANAGEMENT
 */
router.get(
  '/campaigns',
  asyncHandler(async (req: Request, res: Response) => {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10))); // Cap at 50
    const skip = (pageNum - 1) * limitNum;

    const [campaigns, total] = await Promise.all([
      db.campaign.findMany({
        include: {
          stages: {
            orderBy: { order: 'asc' },
            include: {
              messageTemplates: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      db.campaign.count(),
    ]);

    res.json({
      data: campaigns,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

router.post(
  '/campaigns',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, isActive } = req.body;
    const campaign = await db.campaign.create({
      data: {
        name,
        description: description || '',
        isActive: isActive !== undefined ? isActive : true,
        tenant: { connect: { id: (req as any).user.tenantId } },
      },
    });
    res.json(campaign);
  })
);

router.patch(
  '/campaigns/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const campaign = await db.campaign.update({
      where: { id: id as string },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(campaign);
  })
);

router.delete(
  '/campaigns/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await db.campaign.delete({
      where: { id: id as string },
    });
    res.json({ success: true });
  })
);

export default router;
