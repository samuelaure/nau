import { db } from '../core/db.js';
import { logger } from '../core/logger.js';
import { EventsService } from './events.service.js';

export enum LeadState {
  COLD = 'COLD',
  INTERESTED = 'INTERESTED',
  DEMO = 'DEMO',
  NURTURING = 'NURTURING',
  CLIENTS = 'CLIENTS',
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
        state: LeadState.COLD,
        status: 'ACTIVE',
      },
      create: {
        phoneNumber,
        name,
        campaignId,
        currentStageId: firstStage.id,
        state: LeadState.COLD,
      },
    });
  }

  /**
   * Transition lead to new state with validation
   */
  static async transition(leadId: string, newState: LeadState) {
    const lead = await db.lead.findUnique({ where: { id: leadId }, include: { tags: true } });
    if (!lead) throw new Error('Lead not found');

    // Validate state transitions
    const validTransitions: Record<LeadState, LeadState[]> = {
      [LeadState.COLD]: [LeadState.INTERESTED, LeadState.NURTURING, LeadState.CLIENTS],
      [LeadState.INTERESTED]: [LeadState.DEMO, LeadState.CLIENTS, LeadState.NURTURING],
      [LeadState.DEMO]: [LeadState.INTERESTED, LeadState.CLIENTS],
      [LeadState.NURTURING]: [LeadState.CLIENTS], // Can become client while staying nurturing
      [LeadState.CLIENTS]: [LeadState.NURTURING], // Can join nurturing as client
    };

    const currentState = lead.state as LeadState;
    if (!validTransitions[currentState]?.includes(newState)) {
      logger.warn({ leadId, currentState, newState }, 'Invalid state transition attempted');
      // Allow it anyway for flexibility, but log it
    }

    await db.lead.update({
      where: { id: leadId },
      data: {
        state: newState,
        lastInteraction: new Date(),
      },
    });

    logger.info({ leadId, from: currentState, to: newState }, 'Lead state transitioned');
    EventsService.emit('state_change', { leadId, from: currentState, to: newState });
  }

  /**
   * Add tag to lead (with deduplication)
   */
  static async addTag(leadId: string, tagName: string) {
    const lead = await db.lead.findUnique({ where: { id: leadId }, include: { tags: true } });
    if (!lead) return;

    // Check if tag already exists
    if (lead.tags.some((t) => t.name === tagName)) {
      logger.debug({ leadId, tagName }, 'Tag already exists on lead');
      return;
    }

    // Find or create tag
    let tag = await db.tag.findUnique({ where: { name: tagName } });
    if (!tag) {
      tag = await db.tag.create({
        data: { name: tagName, category: 'CUSTOM' },
      });
    }

    await db.lead.update({
      where: { id: leadId },
      data: { tags: { connect: { id: tag.id } } },
    });

    logger.info({ leadId, tagName }, 'Tag added to lead');
  }

  /**
   * Remove tag from lead
   */
  static async removeTag(leadId: string, tagName: string) {
    const tag = await db.tag.findUnique({ where: { name: tagName } });
    if (!tag) return;

    await db.lead.update({
      where: { id: leadId },
      data: { tags: { disconnect: { id: tag.id } } },
    });

    logger.info({ leadId, tagName }, 'Tag removed from lead');
  }

  /**
   * Check if lead has specific tag
   */
  static async hasTag(leadId: string, tagName: string): Promise<boolean> {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: { tags: { where: { name: tagName } } },
    });
    return (lead?.tags.length ?? 0) > 0;
  }

  /**
   * Check if lead is blacklisted
   */
  static async isBlacklisted(leadId: string): Promise<boolean> {
    return this.hasTag(leadId, 'black');
  }

  /**
   * Update lead metadata (merge with existing)
   */
  static async updateMetadata(leadId: string, newData: Record<string, any>) {
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    const currentMetadata = lead.metadata ? JSON.parse(lead.metadata) : {};
    const updatedMetadata = { ...currentMetadata, ...newData };

    await db.lead.update({
      where: { id: leadId },
      data: { metadata: JSON.stringify(updatedMetadata) },
    });

    logger.info({ leadId, newData }, 'Lead metadata updated');
  }

  /**
   * Start demo session
   */
  static async startDemo(leadId: string, durationMinutes: number = 10) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    await db.lead.update({
      where: { id: leadId },
      data: {
        state: LeadState.DEMO,
        demoStartedAt: new Date(),
        demoExpiresAt: expiresAt,
        demoMinutes: durationMinutes,
      },
    });

    logger.info({ leadId, durationMinutes }, 'Demo session started');
  }

  /**
   * End demo session
   */
  static async endDemo(leadId: string) {
    await db.lead.update({
      where: { id: leadId },
      data: { state: LeadState.INTERESTED }, // Return to interested state
    });

    await this.addTag(leadId, 'demo_completed');
    logger.info({ leadId }, 'Demo session ended');
  }

  /**
   * Opt lead into nurturing
   */
  static async optIntoNurturing(leadId: string) {
    await db.lead.update({
      where: { id: leadId },
      data: {
        state: LeadState.NURTURING,
        nurturingOptInAt: new Date(),
        nurturingOnboardingComplete: false,
      },
    });

    await this.addTag(leadId, 'nurturing');
    logger.info({ leadId }, 'Lead opted into nurturing');
  }

  /**
   * Mark nurturing onboarding as complete
   */
  static async completeNurturingOnboarding(leadId: string) {
    await db.lead.update({
      where: { id: leadId },
      data: { nurturingOnboardingComplete: true },
    });

    await this.addTag(leadId, 'onboarding_complete');
    logger.info({ leadId }, 'Nurturing onboarding completed');
  }

  /**
   * Convert lead to client
   */
  static async convertToClient(leadId: string) {
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    // If already in nurturing, keep that state (dual status)
    const newState = lead.state === LeadState.NURTURING ? LeadState.NURTURING : LeadState.CLIENTS;

    await db.lead.update({
      where: { id: leadId },
      data: { state: newState },
    });

    await this.addTag(leadId, 'client');
    logger.info({ leadId }, 'Lead converted to client');
    EventsService.emit('conversion', { leadId });
  }
}
