import { Request, Response, Router } from 'express';
import { db } from '../core/db.js';
import { MetricsService } from '../services/metrics.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { Orchestrator } from '../core/orchestrator.js';
import { logger } from '../core/logger.js';
import { EventsService } from '../services/events.service.js';

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
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const campaigns = await db.campaign.findMany({ where: { isActive: true } });
        const stats = await Promise.all(
            campaigns.map(async (c) => ({
                campaignId: c.id,
                name: c.name,
                metrics: await MetricsService.getCampaignMetrics(c.id),
            }))
        );
        res.json(stats);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch stats');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Get all leads with their current status and tags
 */
router.get('/leads', async (req: Request, res: Response) => {
    try {
        const leads = await db.lead.findMany({
            include: {
                tags: true,
                currentStage: true,
            },
            orderBy: { lastInteraction: 'desc' },
        });
        res.json(leads);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch leads');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Resolve human handover
 */
router.post('/leads/:id/resolve', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await db.lead.update({
            where: { id: id as string },
            data: { status: 'ACTIVE' },
        });
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Failed to resolve lead');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Global Configuration (Availability Status)
 */
router.get('/config/global', async (req: Request, res: Response) => {
    try {
        let config = await db.globalConfig.findUnique({ where: { id: 'singleton' } });
        if (!config) {
            config = await db.globalConfig.create({ data: { id: 'singleton', availabilityStatus: 'disponible' } });
        }
        res.json(config);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch global config');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/config/global', async (req: Request, res: Response) => {
    const { availabilityStatus } = req.body;
    try {
        const config = await db.globalConfig.upsert({
            where: { id: 'singleton' },
            update: { availabilityStatus },
            create: { id: 'singleton', availabilityStatus }
        });
        res.json(config);
    } catch (error) {
        logger.error({ err: error }, 'Failed to update global config');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Keywords for Human Takeover
 */
router.get('/config/keywords', async (req: Request, res: Response) => {
    try {
        const keywords = await db.takeoverKeyword.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(keywords);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch keywords');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/config/keywords', async (req: Request, res: Response) => {
    const { word, type } = req.body;
    try {
        const keyword = await db.takeoverKeyword.create({
            data: {
                word: word.toUpperCase().trim(),
                type: type || 'INTERNAL'
            }
        });
        res.json(keyword);
    } catch (error) {
        logger.error({ err: error }, 'Failed to create keyword');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * LIVE CHAT ENDPOINTS
 */
router.get('/leads/:id/messages', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const messages = await db.message.findMany({
            where: { leadId: id as string },
            orderBy: { timestamp: 'asc' }
        });
        res.json(messages);
    } catch (error) {
        logger.error({ err: error, leadId: id }, 'Failed to fetch messages');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/leads/:id/messages', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;
    try {
        const lead = await db.lead.findUnique({ where: { id: id as string } });
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        // Send via WhatsApp
        const waRes = await WhatsAppService.sendText(lead.phoneNumber, content);
        const whatsappId = waRes?.messages?.[0]?.id;

        // Process as OUTBOUND via Orchestrator to ensure consistency (Silent takeover, logic, etc)
        await Orchestrator.handleIncoming(lead.phoneNumber, content, undefined, 'OUTBOUND', whatsappId);

        res.json({ success: true, whatsappId });
    } catch (error) {
        logger.error({ err: error, leadId: id }, 'Failed to send message');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * BUSINESS & AGENT CONFIG
 */
router.get('/config/business', async (req: Request, res: Response) => {
    try {
        const business = await (db as any).businessProfile.findUnique({ where: { id: 'singleton' } });
        res.json(business || { name: 'whatsnaŭ', knowledgeBase: '' });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/config/business', async (req: Request, res: Response) => {
    const { name, knowledgeBase } = req.body;
    try {
        const business = await (db as any).businessProfile.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', name, knowledgeBase },
            update: { name, knowledgeBase }
        });
        res.json(business);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/config/prompts', async (req: Request, res: Response) => {
    try {
        const prompts = await (db as any).promptConfig.findMany();
        res.json(prompts);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/config/prompts', async (req: Request, res: Response) => {
    const { role, basePrompt } = req.body;
    try {
        const prompt = await (db as any).promptConfig.upsert({
            where: { role },
            create: { role, basePrompt },
            update: { basePrompt }
        });
        res.json(prompt);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/config/sequences', async (req: Request, res: Response) => {
    try {
        const stages = await db.campaignStage.findMany({
            orderBy: { order: 'asc' }
        });
        res.json(stages);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/config/sequences/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, waitHours } = req.body;
    try {
        const stage = await db.campaignStage.update({
            where: { id: id as string },
            data: { name, waitHours: Number(waitHours) }
        });
        res.json(stage);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/leads/:id/ai-toggle', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { aiEnabled } = req.body;
    try {
        const lead = await (db as any).lead.update({
            where: { id: id as string },
            data: { aiEnabled }
        });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/config/whatsapp-templates', async (req: Request, res: Response) => {
    try {
        const templates = await WhatsAppService.getTemplates();
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

router.post('/config/whatsapp-templates', async (req: Request, res: Response) => {
    const { name, category, language, components } = req.body;
    try {
        const result = await WhatsAppService.createTemplate(name, category, language, components);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create template' });
    }
});

router.get('/config/telegram', async (req: Request, res: Response) => {
    try {
        const config = await (db as any).telegramConfig.findUnique({ where: { id: 'singleton' } });
        res.json(config || { botToken: '', chatId: '', isEnabled: false });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/config/telegram', async (req: Request, res: Response) => {
    const { botToken, chatId, isEnabled } = req.body;
    try {
        const config = await (db as any).telegramConfig.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', botToken, chatId, isEnabled },
            update: { botToken, chatId, isEnabled }
        });
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.delete('/config/keywords/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await db.takeoverKeyword.delete({
            where: { id: id as string }
        });
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Failed to delete keyword');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
