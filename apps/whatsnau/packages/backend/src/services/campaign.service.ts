import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

export class CampaignService {
  /**
   * Initializes the reference campaign if it doesn't exist.
   * This is the "Local businesses in Spain" campaign.
   */
  static async seedReferenceCampaign() {
    const campaignName = 'Spain Local Businesses - AI Receptionist Demo';

    const tenant = await db.tenant.findUnique({ where: { slug: 'production' } });
    if (!tenant) return; // Should have been run after seedAdmin

    // Check for existing by name first to avoid unique constraint issues
    const byName = await db.campaign.findFirst({
      where: { name: campaignName, tenantId: tenant.id },
      include: { stages: true, tags: true },
    });

    if (byName) {
      return byName;
    }

    const campaign = await db.campaign.upsert({
      where: { id: 'reference-campaign-spain' },
      update: {
        name: campaignName,
        description:
          'Automated WhatsApp lead capture and response system for local businesses in Spain.',
      },
      create: {
        id: 'reference-campaign-spain',
        name: campaignName,
        description:
          'Automated WhatsApp lead capture and response system for local businesses in Spain.',
        tenantId: tenant.id,
      },
      include: {
        stages: true,
        tags: true,
      },
    });

    // Seed stages if empty
    if (campaign.stages.length === 0) {
      logger.info('Seeding stages for reference campaign...');
      await db.campaignStage.createMany({
        data: [
          { campaignId: campaign.id, name: 'M1-Initial-Hook', order: 1, waitHours: 0 },
          { campaignId: campaign.id, name: 'M2-Same-Day-FollowUp', order: 2, waitHours: 8 },
          { campaignId: campaign.id, name: 'M3-Final-Touch', order: 3, waitHours: 24 },
          { campaignId: campaign.id, name: 'CONVERSATIONAL_PRE_SALE', order: 4, waitHours: 0 },
          { campaignId: campaign.id, name: 'LIVE_DEMO', order: 5, waitHours: 0 },
          { campaignId: campaign.id, name: 'LONG_TERM_NURTURING', order: 6, waitHours: 0 },
        ],
      });
    }

    // Seed tags if empty (safe way without violating unique Name)
    if (campaign.tags.length === 0) {
      logger.info('Linking tags for reference campaign...');
      const tagNames = [
        'interested',
        'not_interested',
        'nurturing_opt_in',
        'demo_completed',
        'blocked',
      ];
      for (const tName of tagNames) {
        await db.campaign.update({
          where: { id: campaign.id },
          data: {
            tags: {
              connectOrCreate: {
                where: {
                  tenantId_name: { tenantId: tenant.id, name: tName },
                },
                create: { name: tName, category: 'INTENT', tenantId: tenant.id },
              },
            },
          },
        });
      }
    }

    logger.info(`Reference campaign ready with ${campaign.stages.length} stages.`);
    return campaign;
  }

  static async getCampaignWithStages(id: string) {
    return db.campaign.findUnique({
      where: { id },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
  }
}
