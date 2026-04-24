import { db } from '../core/db.js';
import { logger } from '../core/logger.js';
import { WhatsAppService } from './whatsapp.service.js';

export class TemplateSyncService {
  /**
   * Sync WhatsApp templates from Meta API to database
   */
  static async syncTemplatesFromMeta(tenantId: string) {
    logger.info({ tenantId }, 'Syncing WhatsApp templates from Meta for tenant...');

    try {
      const response = await WhatsAppService.getTemplates(tenantId);

      // If no templates returned (likely because WhatsApp isn't configured), skip sync
      if (!response.data || response.data.length === 0) {
        logger.info('No templates to sync (WhatsApp may not be configured yet)');
        return { synced: 0 };
      }

      const metaTemplates = response.data;

      logger.info({ count: metaTemplates.length }, 'Fetched templates from Meta');

      for (const metaTemplate of metaTemplates) {
        await this.upsertTemplate(metaTemplate);
      }

      logger.info('Template sync completed successfully');
      return { synced: metaTemplates.length };
    } catch (error) {
      logger.error({ err: error }, 'Failed to sync templates from Meta');
      throw error;
    }
  }

  /**
   * Upsert a single template from Meta
   */
  private static async upsertTemplate(metaTemplate: any) {
    const { id: metaTemplateId, name, status, category, language, components } = metaTemplate;

    await db.whatsAppTemplate.upsert({
      where: { name },
      update: {
        metaTemplateId,
        status,
        category,
        language,
        components: JSON.stringify(components),
        lastSyncedAt: new Date(),
      },
      create: {
        metaTemplateId,
        name,
        status,
        category,
        language,
        components: JSON.stringify(components),
      },
    });

    logger.debug({ name, status }, 'Template synced');
  }

  /**
   * Link a Meta template to an internal MessageTemplate
   */
  static async linkTemplateToMessage(
    whatsappTemplateId: string,
    messageTemplateId: string,
    variableMapping?: Record<string, string>
  ) {
    await db.whatsAppTemplate.update({
      where: { id: whatsappTemplateId },
      data: {
        messageTemplateId,
        variableMapping: variableMapping ? JSON.stringify(variableMapping) : null,
      },
    });

    logger.info(
      { whatsappTemplateId, messageTemplateId },
      'Linked WhatsApp template to MessageTemplate'
    );
  }

  /**
   * Get all approved templates
   */
  static async getApprovedTemplates() {
    return db.whatsAppTemplate.findMany({
      where: { status: 'APPROVED' },
      include: { messageTemplate: true },
    });
  }

  /**
   * Get template by name
   */
  static async getTemplateByName(name: string) {
    return db.whatsAppTemplate.findUnique({
      where: { name },
      include: { messageTemplate: true },
    });
  }

  /**
   * Check if a MessageTemplate has an approved WhatsApp template
   */
  static async hasApprovedTemplate(messageTemplateId: string): Promise<boolean> {
    const whatsappTemplate = await db.whatsAppTemplate.findFirst({
      where: {
        messageTemplateId,
        status: 'APPROVED',
      },
    });

    return !!whatsappTemplate;
  }

  /**
   * Get WhatsApp template for a MessageTemplate
   */
  static async getWhatsAppTemplateForMessage(messageTemplateId: string) {
    return db.whatsAppTemplate.findFirst({
      where: {
        messageTemplateId,
        status: 'APPROVED',
      },
    });
  }

  /**
   * Render template with variable mapping
   * Converts our variables ({{name}}) to Meta's format ({{1}})
   */
  static renderTemplateForMeta(
    template: string,
    context: Record<string, any>,
    variableMapping: Record<string, string>
  ): any[] {
    // Build components array for Meta API
    const components: any[] = [];

    // Extract variables from template in order
    const variables: string[] = [];
    Object.entries(variableMapping).forEach(([metaIndex, ourVar]) => {
      if (context[ourVar]) {
        variables[parseInt(metaIndex) - 1] = String(context[ourVar]);
      }
    });

    if (variables.length > 0) {
      components.push({
        type: 'body',
        parameters: variables.map((value) => ({
          type: 'text',
          text: value,
        })),
      });
    }

    return components;
  }
}
