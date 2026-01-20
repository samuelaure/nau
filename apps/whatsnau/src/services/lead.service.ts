import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

export enum LeadState {
  OUTREACH = 'OUTREACH',
  PRE_SALE = 'PRE_SALE',
  DEMO = 'DEMO',
  NURTURING = 'NURTURING',
  CONVERTED = 'CONVERTED',
  BLOCKED = 'BLOCKED',
}

export class LeadService {
  /**
   * Creates a new lead and assigns it to the first stage of a campaign.
   */
  static async initiateLead(phoneNumber: string, campaignId: string, name?: string) {
    const firstStage = await db.campaignStage.findFirst({
      where: { campaignId },
      orderBy: { order: 'asc' },
    });

    if (!firstStage) {
      throw new Error('Campaign has no stages');
    }

    return db.lead.upsert({
      where: { phoneNumber },
      update: {
        campaignId,
        currentStageId: firstStage.id,
        state: LeadState.OUTREACH,
        status: 'ACTIVE',
      },
      create: {
        phoneNumber,
        name,
        campaignId,
        currentStageId: firstStage.id,
        state: LeadState.OUTREACH,
      },
    });
  }

  /**
   * Transitions a lead to a specific state or stage.
   */
  static async transition(leadId: string, newState: LeadState, stageId?: string) {
    logger.info(
      `Transitioning lead ${leadId} to state ${newState}${stageId ? ` and stage ${stageId}` : ''}`
    );

    return db.lead.update({
      where: { id: leadId },
      data: {
        state: newState,
        currentStageId: stageId,
        lastInteraction: new Date(),
      },
    });
  }

  /**
   * Adds a tag to a lead.
   */
  static async addTag(leadId: string, tagName: string) {
    // Find or create tag
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    return db.lead.update({
      where: { id: leadId },
      data: {
        tags: {
          connectOrCreate: {
            where: { id: tagName }, // This is a bit simplified, usually tags are shared
            create: { name: tagName, campaignId: lead.campaignId },
          },
        },
      },
    });
  }
}
