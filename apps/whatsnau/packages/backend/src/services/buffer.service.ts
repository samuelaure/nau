import { db } from '../core/db.js';
import { logger } from '../core/logger.js';
import { Orchestrator } from '../core/orchestrator.js';

export class MessageBufferService {
  private static timers: Map<string, NodeJS.Timeout> = new Map();
  private static WAIT_WINDOW_MS = 15000; // 15 seconds

  /**
   * Schedules or resets the debounced processing for a lead.
   */
  static async scheduleProcessing(tenantId: string, phoneNumber: string) {
    const key = `${tenantId}:${phoneNumber}`;
    logger.info({ tenantId, phoneNumber }, 'Scheduling lead processing window');

    // 1. Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // 2. Set new timer
    const timeout = setTimeout(async () => {
      try {
        await this.processLeadBuffer(tenantId, phoneNumber);
      } catch (error) {
        logger.error({ err: error, tenantId, phoneNumber }, 'Error processing lead buffer');
      } finally {
        this.timers.delete(key);
      }
    }, this.WAIT_WINDOW_MS);

    this.timers.set(key, timeout);
  }

  /**
   * Triggers the Orchestrator for the accumulated messages.
   */
  private static async processLeadBuffer(tenantId: string, phoneNumber: string) {
    const lead = await db.lead.findUnique({
      where: {
        tenantId_phoneNumber: {
          tenantId,
          phoneNumber,
        },
      },
      select: { id: true, isProcessingAI: true },
    });

    if (!lead) return;

    // Safety: don't start if already processing (unless the previous one hung)
    if (lead.isProcessingAI) {
      logger.warn({ leadId: lead.id }, 'Lead already processing AI, delaying buffer');
      // Retry in 5 seconds
      return this.scheduleProcessing(tenantId, phoneNumber);
    }

    logger.info({ leadId: lead.id }, 'Processing buffered messages for lead');

    // Set processing flag
    await db.lead.update({
      where: { id: lead.id },
      data: { isProcessingAI: true },
    });

    try {
      await Orchestrator.processBurst(tenantId, phoneNumber);
    } finally {
      // Release processing flag
      await db.lead.update({
        where: { id: lead.id },
        data: { isProcessingAI: false },
      });
    }
  }
}
