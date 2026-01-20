import { db } from '../core/db.js';

export class MetricsService {
    /**
     * Generates a high-level summary of campaign performance.
     */
    static async getCampaignMetrics(campaignId: string) {
        const totalContacts = await db.lead.count({ where: { campaignId } });

        // Funnel tracking
        const delivered = await db.lead.count({
            where: {
                campaignId,
                messages: { some: { direction: 'OUTBOUND', status: 'delivered' } }
            }
        });

        const read = await db.lead.count({
            where: {
                campaignId,
                messages: { some: { direction: 'OUTBOUND', status: 'read' } }
            }
        });

        const replied = await db.lead.count({
            where: {
                campaignId,
                messages: { some: { direction: 'INBOUND' } }
            }
        });

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
            delivered,
            read,
            replied,
            interested,
            conversions,
            blocked,
            deliveryRate: totalContacts > 0 ? (delivered / totalContacts) * 100 : 0,
            openRate: delivered > 0 ? (read / delivered) * 100 : 0,
            replyRate: read > 0 ? (replied / read) * 100 : 0,
            conversionRate: totalContacts > 0 ? (conversions / totalContacts) * 100 : 0
        };
    }
}
