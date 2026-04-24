import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

export class TemplateService {
  /**
   * Get message template for a campaign stage
   */
  static async getTemplate(stageId: string, order: number = 1) {
    const template = await db.messageTemplate.findFirst({
      where: { stageId, order },
    });
    return template;
  }

  /**
   * Render template with lead context
   */
  static renderTemplate(template: string, context: Record<string, any>): string {
    let rendered = template;

    // Replace {{variable}} placeholders
    Object.entries(context).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, String(value ?? ''));
    });

    // Clean up any remaining unreplaced variables
    rendered = rendered.replace(/{{[^}]+}}/g, '');

    return rendered;
  }

  /**
   * Get rendered message for a lead at a specific stage
   */
  static async getRenderedMessage(leadId: string, stageId: string, order: number = 1) {
    const [lead, template] = await Promise.all([
      db.lead.findUnique({ where: { id: leadId } }),
      this.getTemplate(stageId, order),
    ]);

    if (!lead || !template) return null;

    // Build context from lead data
    const metadata = lead.metadata ? JSON.parse(lead.metadata) : {};
    const context = {
      name: lead.name || 'amigo/a',
      business: metadata.businessName || 'tu negocio',
      industry: metadata.industry || '',
      ...metadata,
    };

    return this.renderTemplate(template.content, context);
  }

  /**
   * Get all templates for a campaign stage
   */
  static async getStageTemplates(stageId: string) {
    return db.messageTemplate.findMany({
      where: { stageId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Create or update a message template
   */
  static async upsertTemplate(
    stageId: string,
    content: string,
    order: number = 1,
    hasButtons: boolean = false,
    buttons?: any
  ) {
    const existing = await db.messageTemplate.findFirst({
      where: { stageId, order },
    });

    if (existing) {
      return db.messageTemplate.update({
        where: { id: existing.id },
        data: {
          content,
          hasButtons,
          buttons: buttons ? JSON.stringify(buttons) : null,
        },
      });
    }

    return db.messageTemplate.create({
      data: {
        stageId,
        content,
        order,
        hasButtons,
        buttons: buttons ? JSON.stringify(buttons) : null,
      },
    });
  }
}
