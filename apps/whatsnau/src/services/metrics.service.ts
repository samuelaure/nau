import { db } from '../core/db.js';

export class MetricsService {
    /**
     * Generates a high-level summary of campaign performance.
     */
    static async getCampaignMetrics(campaignId: string) {
        const totalContacts = await db.lead.count({ where: { campaignId } });

        const interested = await db.lead.count({
            where: {
                campaignId,
                tags: { some: { name: 'interested' } }
            }
        });

        const conversions = await db.lead.count({
            where: {
                campaignId,
                state: 'CONVERTED'
            }
        });

        const blocked = await db.lead.count({
            where: {
                campaignId,
                status: 'BLOCKED'
            }
        });

        return {
            totalContacts,
            interested,
            conversions,
            blocked,
            conversionRate: totalContacts > 0 ? (conversions / totalContacts) * 100 : 0
        };
    }
}
