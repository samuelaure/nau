import { Request, Response, Router } from 'express';
import { db } from '../core/db.js';
import { MetricsService } from '../services/metrics.service.js';
import { logger } from '../core/logger.js';

const router = Router();

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
