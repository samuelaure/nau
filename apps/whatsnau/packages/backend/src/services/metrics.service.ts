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
        messages: { some: { direction: 'OUTBOUND', status: 'delivered' } },
      },
    });

    const read = await db.lead.count({
      where: {
        campaignId,
        messages: { some: { direction: 'OUTBOUND', status: 'read' } },
      },
    });

    const replied = await db.lead.count({
      where: {
        campaignId,
        messages: { some: { direction: 'INBOUND' } },
      },
    });

    const interested = await db.lead.count({
      where: {
        campaignId,
        tags: { some: { name: 'interested' } },
      },
    });

    const conversions = await db.lead.count({
      where: {
        campaignId,
        state: 'CONVERTED',
      },
    });

    const blocked = await db.lead.count({
      where: {
        campaignId,
        status: 'BLOCKED',
      },
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
      conversionRate: totalContacts > 0 ? (conversions / totalContacts) * 100 : 0,
    };
  }

  /**
   * Get overall metrics for a tenant, including AI efficiency and orders.
   */
  static async getTenantMetrics(tenantId: string) {
    const [aiHandledLeads, pendingHandover, draftOrders, pendingOrders] = await Promise.all([
      db.lead.count({
        where: { tenantId, status: 'ACTIVE', aiEnabled: true },
      }),
      db.lead.count({
        where: { tenantId, status: 'HANDOVER' },
      }),
      (db as any).order.count({
        where: { tenantId, status: 'DRAFT' },
      }),
      (db as any).order.count({
        where: { tenantId, status: 'PENDING' },
      }),
    ]);

    const recentDrafts = await (db as any).order.findMany({
      where: { tenantId, status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { lead: true, items: { include: { product: true } } },
    });

    return {
      aiHandledLeads,
      pendingHandover,
      draftOrders,
      pendingOrders,
      totalPendingValue: recentDrafts.reduce((acc: number, o: any) => acc + o.totalAmount, 0),
      recentOrders: recentDrafts.map((o: any) => ({
        id: o.id,
        leadName: o.lead.name || o.lead.phoneNumber,
        amount: o.totalAmount,
        createdAt: o.createdAt,
      })),
    };
  }
}
