import { db } from '../core/db.js';
import { AIService } from './ai.service.js';
import { logger } from '../core/logger.js';

export class RetrievalService {
  /**
   * Strategically fetch relevant data based on the last user message.
   * This avoids prompt bloat by only providing what's necessary.
   */
  static async getRelevantContext(
    leadId: string,
    tenantId: string,
    lastMessage: string
  ): Promise<string> {
    const contextParts: string[] = [];

    // 1. Ask a cheap model (Context Weaver) what data is needed
    // This is the "AI Assistant for the AI Assistant"
    const intentQuery = `
      Basado en el siguiente mensaje de un cliente, ¿qué información del negocio crees que es necesaria para responder?
      Categorías: [PRODUCTOS, PEDIDOS, INFORMACION_GENERAL, NINGUNA]
      Mensaje: "${lastMessage}"
      Responde solo con la categoría o categorías separadas por coma.
    `;

    const needs = await AIService.getChatResponse(intentQuery, [], false); // Use cheap model
    const needsUpper = needs?.toUpperCase() || '';

    // 2. Conditional data fetching
    if (needsUpper.includes('PRODUCTOS')) {
      const products = await (db as any).product.findMany({
        where: { tenantId, isActive: true },
        take: 5,
      });
      if (products.length > 0) {
        contextParts.push(
          `### PRODUCTOS RELEVANTES:\n${products.map((p: any) => `- ${p.name}: ${p.description} (${p.price} EUR)`).join('\n')}`
        );
      }
    }

    if (needsUpper.includes('PEDIDOS')) {
      const lastOrders = await (db as any).order.findMany({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { items: { include: { product: true } } },
      });
      if (lastOrders.length > 0) {
        contextParts.push(
          `### ÚLTIMOS PEDIDOS DEL CLIENTE:\n${lastOrders.map((o: any) => `- Pedido ${o.id}: Estado ${o.status}, Total ${o.totalAmount} EUR`).join('\n')}`
        );
      }
    }

    // 3. Always include core business summary if context is light
    if (contextParts.length === 0 || needsUpper.includes('INFORMACION_GENERAL')) {
      // We could fetch a short summary here
    }

    return contextParts.join('\n\n');
  }
}
