import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

export class CampaignService {
    /**
     * Initializes the reference campaign if it doesn't exist.
     * This is the "Local businesses in Spain" campaign.
     */
    static async seedReferenceCampaign() {
        const campaignName = 'Spain Local Businesses - AI Receptionist Demo';

        const existing = await db.campaign.findFirst({
            where: { name: campaignName }
        });

        if (existing) {
            logger.info('Reference campaign already exists');
            return existing;
        }

        logger.info('Seeding reference campaign...');

        const campaign = await db.campaign.create({
            data: {
                name: campaignName,
                description: 'Automated WhatsApp lead capture and response system for local businesses in Spain.',
                stages: {
                    create: [
                        { name: 'M1-Initial-Hook', order: 1, waitHours: 0 },
                        { name: 'M2-Same-Day-FollowUp', order: 2, waitHours: 8 },
                        { name: 'M3-Final-Touch', order: 3, waitHours: 24 },
                        { name: 'CONVERSATIONAL_PRE_SALE', order: 4, waitHours: 0 },
                        { name: 'LIVE_DEMO', order: 5, waitHours: 0 },
                        { name: 'LONG_TERM_NURTURING', order: 6, waitHours: 0 }
                    ]
                },
                tags: {
                    create: [
                        { name: 'interested', category: 'INTENT' },
                        { name: 'not_interested', category: 'INTENT' },
                        { name: 'nurturing_opt_in', category: 'INTENT' },
                        { name: 'demo_completed', category: 'SYSTEM' },
                        { name: 'blocked', category: 'SYSTEM' }
                    ]
                }
            },
            include: {
                stages: true
            }
        });

        logger.info(`Reference campaign created with ${campaign.stages.length} stages.`);
        return campaign;
    }

    static async getCampaignWithStages(id: string) {
        return db.campaign.findUnique({
            where: { id },
            include: { stages: { orderBy: { order: 'asc' } } }
        });
    }
}
