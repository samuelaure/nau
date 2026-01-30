import { Request, Response, Router } from 'express';
import { db } from '../core/db.js';
import { ImportService } from '../services/import.service.js';
import { AnalysisService } from '../services/analysis.service.js';
import { asyncHandler } from '../core/errors/asyncHandler.js';
import { NotFoundError } from '../core/errors/AppError.js';

const router = Router();

/**
 * RAW CSV IMPORT
 */
router.post(
  '/csv',
  asyncHandler(async (req: Request, res: Response) => {
    const { campaignId, name, csvContent } = req.body;
    const tenantId = (req as any).user.tenantId;
    const batch = await ImportService.processCSV(campaignId, name, csvContent, tenantId);
    res.json(batch);
  })
);

/**
 * BATCH LIST
 */
router.get(
  '/batches',
  asyncHandler(async (req: Request, res: Response) => {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10))); // Cap at 50
    const skip = (pageNum - 1) * limitNum;

    const [batches, total] = await Promise.all([
      (db as any).leadImportBatch.findMany({
        include: { _count: { select: { stagingLeads: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      (db as any).leadImportBatch.count(),
    ]);

    res.json({
      data: batches,
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
 * BATCH DETAILS
 */
router.get(
  '/batches/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const batch = await ImportService.getBatchDetails(req.params.id as string);
    if (!batch) throw new NotFoundError('Batch not found');
    res.json(batch);
  })
);

/**
 * TRIGGER CLEANSE
 */
router.post(
  '/batches/:id/cleanse',
  asyncHandler(async (req: Request, res: Response) => {
    await AnalysisService.cleanseBatch(req.params.id as string);
    res.json({ success: true });
  })
);

/**
 * TRIGGER WHATSAPP VERIFICATION
 */
router.post(
  '/batches/:id/verify-wa',
  asyncHandler(async (req: Request, res: Response) => {
    await AnalysisService.verifyBatchWhatsApp(req.params.id as string);
    res.json({ success: true });
  })
);

/**
 * TRIGGER AI ANALYSIS
 */
router.post(
  '/batches/:id/analyze-ai',
  asyncHandler(async (req: Request, res: Response) => {
    await AnalysisService.performDeepAIAnalysis(req.params.id as string);
    res.json({ success: true });
  })
);

/**
 * EXECUTE: PUSH TO ACTUAL CAMPAIGN
 * USES PLATFORM RESILIENCE: PRISMA TRANSACTION
 */
router.post(
  '/batches/:id/execute',
  asyncHandler(async (req: Request, res: Response) => {
    const { leadIds } = req.body;
    const batchId = req.params.id;

    const batch = await (db as any).leadImportBatch.findUnique({
      where: { id: batchId },
      include: { campaign: true },
    });

    if (!batch) throw new NotFoundError('Batch not found');

    const firstStage = await db.campaignStage.findFirst({
      where: { campaignId: batch.campaignId },
      orderBy: { order: 'asc' },
    });

    const stagingLeads = await (db as any).stagingLead.findMany({
      where: {
        batchId,
        id: leadIds ? { in: leadIds } : undefined,
        cleanseStatus: 'CLEANED',
        isValidWhatsApp: true,
      },
      include: { opportunities: true },
    });

    // START RESILIENT TRANSACTION
    await db.$transaction(async (tx) => {
      await (tx as any).leadImportBatch.update({
        where: { id: batchId },
        data: { status: 'EXECUTING' },
      });

      for (const s of stagingLeads) {
        const existing = await tx.lead.findUnique({
          where: {
            tenantId_phoneNumber: {
              tenantId: (req as any).user.tenantId,
              phoneNumber: s.phoneNumber,
            },
          },
        });

        if (existing) {
          await tx.lead.update({
            where: { id: existing.id },
            data: {
              campaignId: batch.campaignId,
              currentStageId: firstStage?.id,
              state: 'OUTREACH',
            },
          });
        } else {
          const lead = await tx.lead.create({
            data: {
              phoneNumber: s.phoneNumber,
              name: s.name,
              campaignId: batch.campaignId,
              currentStageId: firstStage?.id,
              state: 'COLD',
              metadata: s.rawData,
              tenantId: (req as any).user.tenantId,
            },
          });

          for (const opt of s.opportunities) {
            await (tx as any).opportunity.create({
              data: {
                leadId: lead.id,
                type: opt.type,
                description: opt.description,
                severity: opt.severity,
                aiGenerated: opt.aiGenerated,
              },
            });
          }
        }
      }

      await (tx as any).leadImportBatch.update({
        where: { id: batchId },
        data: { status: 'COMPLETED' },
      });
    });

    res.json({ success: true, count: stagingLeads.length });
  })
);

/**
 * REACH: Start sending M1 to leads in this batch
 */
router.post(
  '/batches/:id/reach',
  asyncHandler(async (req: Request, res: Response) => {
    const batchId = req.params.id;
    const batch = await (db as any).leadImportBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundError('Batch not found');

    const leads = await db.lead.findMany({
      where: {
        campaignId: batch.campaignId,
        messages: { none: {} },
        state: 'OUTREACH',
      },
    });

    const firstStage = await db.campaignStage.findFirst({
      where: { campaignId: batch.campaignId },
      orderBy: { order: 'asc' },
    });

    const { SequenceService } = await import('../services/sequence.service.js');

    for (const lead of leads) {
      await SequenceService.sendStageMessage(lead, firstStage);
    }

    res.json({ success: true, count: leads.length });
  })
);

export default router;
