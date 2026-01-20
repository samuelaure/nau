import { Request, Response, Router } from 'express';
import { db } from '../core/db.js';
import { logger } from '../core/logger.js';
import { ImportService } from '../services/import.service.js';
import { AnalysisService } from '../services/analysis.service.js';

const router = Router();

/**
 * RAW CSV IMPORT
 */
router.post('/csv', async (req: Request, res: Response) => {
    const { campaignId, name, csvContent } = req.body;
    try {
        const batch = await ImportService.processCSV(campaignId, name, csvContent);
        res.json(batch);
    } catch (error) {
        logger.error({ err: error }, 'CSV Import failed');
        res.status(500).json({ error: 'Failed to process CSV' });
    }
});

/**
 * BATCH LIST
 */
router.get('/batches', async (req: Request, res: Response) => {
    try {
        const batches = await (db as any).leadImportBatch.findMany({
            include: { _count: { select: { stagingLeads: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(batches);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * BATCH DETAILS
 */
router.get('/batches/:id', async (req: Request, res: Response) => {
    try {
        const batch = await ImportService.getBatchDetails(req.params.id as string);
        res.json(batch);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * TRIGGER CLEANSE
 */
router.post('/batches/:id/cleanse', async (req: Request, res: Response) => {
    try {
        await AnalysisService.cleanseBatch(req.params.id as string);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Cleanse failed' });
    }
});

/**
 * TRIGGER WHATSAPP VERIFICATION
 */
router.post('/batches/:id/verify-wa', async (req: Request, res: Response) => {
    try {
        await AnalysisService.verifyBatchWhatsApp(req.params.id as string);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'WhatsApp verification failed' });
    }
});

/**
 * TRIGGER AI ANALYSIS
 */
router.post('/batches/:id/analyze-ai', async (req: Request, res: Response) => {
    try {
        await AnalysisService.performDeepAIAnalysis(req.params.id as string);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'AI Analysis failed' });
    }
});

/**
 * EXECUTE: PUSH TO ACTUAL CAMPAIGN
 */
router.post('/batches/:id/execute', async (req: Request, res: Response) => {
    const { leadIds } = req.body; // Array of staging lead IDs or all if empty
    const batchId = req.params.id;

    try {
        const batch = await (db as any).leadImportBatch.findUnique({
            where: { id: batchId },
            include: { campaign: true }
        });

        await (db as any).leadImportBatch.update({
            where: { id: batchId },
            data: { status: 'EXECUTING' }
        });

        const stagingLeads = await (db as any).stagingLead.findMany({
            where: {
                batchId,
                id: leadIds ? { in: leadIds } : undefined,
                cleanseStatus: 'CLEANED',
                isValidWhatsApp: true
            },
            include: { opportunities: true }
        });

        for (const s of stagingLeads) {
            // Check if already exists in Lead
            const existing = await db.lead.findFirst({ where: { phoneNumber: s.phoneNumber } });
            if (existing) continue;

            const lead = await db.lead.create({
                data: {
                    phoneNumber: s.phoneNumber,
                    name: s.name,
                    campaignId: batch.campaignId,
                    metadata: s.rawData
                }
            });

            // Transfer opportunities
            for (const opt of s.opportunities) {
                await (db as any).opportunity.create({
                    data: {
                        leadId: lead.id,
                        type: opt.type,
                        description: opt.description,
                        severity: opt.severity,
                        aiGenerated: opt.aiGenerated
                    }
                });
            }
        }

        await (db as any).leadImportBatch.update({
            where: { id: batchId },
            data: { status: 'COMPLETED' }
        });

        res.json({ success: true, count: stagingLeads.length });
    } catch (error) {
        logger.error({ err: error }, 'Batch execution failed');
        res.status(500).json({ error: 'Execution failed' });
    }
});

export default router;
