import { Request, Response, Router } from 'express';
import { db } from '../core/db.js';
import { MetricsService } from '../services/metrics.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { Orchestrator } from '../core/orchestrator.js';
import { logger } from '../core/logger.js';
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
 * Get all leads with their current status and tags
 */
router.get(
  '/leads',
  asyncHandler(async (req: Request, res: Response) => {
    const leads = await db.lead.findMany({
      include: {
        tags: true,
        currentStage: true,
      },
      orderBy: { lastInteraction: 'desc' },
    });
    res.json(leads);
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
        data: { id: 'singleton', availabilityStatus: 'disponible' },
      });
    }
    res.json(config);
  })
);

router.post(
  '/config/global',
  asyncHandler(async (req: Request, res: Response) => {
    const { availabilityStatus } = req.body;
    const config = await db.globalConfig.upsert({
      where: { id: 'singleton' },
      update: { availabilityStatus },
      create: { id: 'singleton', availabilityStatus },
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
    const lead = await db.lead.findUnique({ where: { id: id as string } });
    if (!lead) throw new NotFoundError('Lead not found');

    // Send via WhatsApp
    const waRes = await WhatsAppService.sendText(lead.phoneNumber, content);
    const whatsappId = waRes?.messages?.[0]?.id;

    // Process as OUTBOUND via Orchestrator to ensure consistency
    await Orchestrator.handleIncoming(lead.phoneNumber, content, undefined, 'OUTBOUND', whatsappId);

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
      create: { id: 'singleton', name, knowledgeBase },
      update: { name, knowledgeBase },
    });
    res.json(business);
  })
);

router.get(
  '/config/prompts',
  asyncHandler(async (req: Request, res: Response) => {
    const prompts = await (db as any).promptConfig.findMany();
    res.json(prompts);
  })
);

router.post(
  '/config/prompts',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, basePrompt } = req.body;
    const prompt = await (db as any).promptConfig.upsert({
      where: { role },
      create: { role, basePrompt },
      update: { basePrompt },
    });
    res.json(prompt);
  })
);

router.get(
  '/config/sequences',
  asyncHandler(async (req: Request, res: Response) => {
    const stages = await db.campaignStage.findMany({
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
    const templates = await WhatsAppService.getTemplates();
    res.json(templates);
  })
);

router.post(
  '/config/whatsapp-templates',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, category, language, components } = req.body;
    const result = await WhatsAppService.createTemplate(name, category, language, components);
    res.json(result);
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
      create: { id: 'singleton', botToken, chatId, isEnabled },
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

export default router;
