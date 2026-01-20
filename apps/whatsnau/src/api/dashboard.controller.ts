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

export default router;
