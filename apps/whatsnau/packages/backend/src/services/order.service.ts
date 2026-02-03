import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

export class OrderService {
  /**
   * Create a draft order for a lead.
   */
  static async createDraftOrder(leadId: string, items: { productId: string; quantity: number }[]) {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: { tenantId: true },
    });

    if (!lead) throw new Error('Lead not found');

    // 1. Fetch products to get prices
    const productIds = items.map((i) => i.productId);
    const products = await (db as any).product.findMany({
      where: { id: { in: productIds } },
    });

    // 2. Calculate totals
    let totalAmount = 0;
    const orderItemsData = items.map((item) => {
      const product = products.find((p: any) => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);

      const unitPrice = product.price;
      totalAmount += unitPrice * item.quantity;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
      };
    });

    // 3. Create Order
    const order = await (db as any).order.create({
      data: {
        leadId,
        tenantId: lead.tenantId,
        status: 'DRAFT',
        totalAmount,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const { EventsService } = await import('./events.service.js');
    EventsService.emit('order.created', {
      orderId: order.id,
      leadId,
      totalAmount,
      tenantId: lead.tenantId,
    });

    logger.info({ orderId: order.id, leadId }, 'Draft order created by AI');
    return order;
  }
}
