import { db } from '../core/db.js';
import { logger } from '../core/logger.js';
import { Orchestrator } from '../core/orchestrator.js';

export class MessageBufferService {
  private static timers: Map<string, NodeJS.Timeout> = new Map();
  private static WAIT_WINDOW_MS = 15000; // 15 seconds

  /**
   * Schedules or resets the debounced processing for a lead.
   */
  static async scheduleProcessing(phoneNumber: string) {
    logger.info({ phoneNumber }, 'Scheduling lead processing window');

    // 1. Clear existing timer if any
    if (this.timers.has(phoneNumber)) {
      clearTimeout(this.timers.get(phoneNumber));
    }

    // 2. Set new timer
    const timeout = setTimeout(async () => {
      try {
        await this.processLeadBuffer(phoneNumber);
      } catch (error) {
        logger.error({ err: error, phoneNumber }, 'Error processing lead buffer');
      } finally {
        this.timers.delete(phoneNumber);
      }
    }, this.WAIT_WINDOW_MS);

    this.timers.set(phoneNumber, timeout);
  }

  /**
   * Triggers the Orchestrator for the accumulated messages.
   */
  private static async processLeadBuffer(phoneNumber: string) {
    const lead = await db.lead.findUnique({
      where: { phoneNumber },
      select: { id: true, isProcessingAI: true },
    });

    if (!lead) return;

    // Safety: don't start if already processing (unless the previous one hung)
    if (lead.isProcessingAI) {
      logger.warn({ phoneNumber }, 'Lead already processing AI, delaying buffer');
      // Retry in 5 seconds
      return this.scheduleProcessing(phoneNumber);
    }

    logger.info({ phoneNumber }, 'Processing buffered messages for lead');

    // Set processing flag
    await db.lead.update({
      where: { id: lead.id },
      data: { isProcessingAI: true },
    });

    try {
      await Orchestrator.processBurst(phoneNumber);
    } finally {
      // Release processing flag
      await db.lead.update({
        where: { id: lead.id },
        data: { isProcessingAI: false },
      });
    }
  }
}
