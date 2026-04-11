import { ZazuSkill, ZazuContext } from '@zazu/skills-core';
import axios from 'axios';
import dayjs from 'dayjs';
import { logger } from './lib/logger';

export class SummarySkill implements ZazuSkill {
  id = 'core-summary';
  name = 'Period Summary Engine';
  priority = 90; // High priority, just under Triage (100)

  async canHandle(ctx: ZazuContext): Promise<boolean> {
    const text = ctx.textContent?.toLowerCase() || '';
    return text.startsWith('/resumen') || text.startsWith('#resumen');
  }

  async handle(ctx: ZazuContext): Promise<void> {
    if (!ctx.textContent) return;

    const parts = ctx.textContent.trim().split(' ');
    
    // Default to 'custom' and use last week if no dates provided
    let periodType = 'custom';
    let startDate = dayjs().subtract(7, 'days').startOf('day').toISOString();
    let endDate = dayjs().endOf('day').toISOString();

    if (parts.length >= 3) {
      startDate = dayjs(parts[1]).startOf('day').toISOString();
      endDate = dayjs(parts[2]).endOf('day').toISOString();
    }

    const waitMsg = await ctx.reply(`📊 Diseñando tu resumen desde ${dayjs(startDate).format('DD MMM')} hasta ${dayjs(endDate).format('DD MMM')}...`);

    try {
      const nauUrl = process.env.NAU_API_URL || 'http://localhost:3000';
      const nauKey = process.env.NAU_SERVICE_KEY;

      const response = await axios.post(`${nauUrl}/api/journal/summary`, {
        periodType,
        startDate,
        endDate
      }, {
        headers: { Authorization: `Bearer ${nauKey}` }
      });

      if (response.data && response.data.success) {
        // Edit waitMsg with success
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          waitMsg.message_id,
          undefined,
          `✅ Resumen generado y encolado. Te llegará automáticamente vía Zazŭ en unos momentos.`
        );
      } else {
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          waitMsg.message_id,
          undefined,
          `⚠️ No pude generar el resumen: ${response.data?.error || 'Error desconocido'}`
        );
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg }, 'SummarySkill error');
      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        waitMsg.message_id,
        undefined,
        `⚠️ Error de conexión al generar el resumen.`
      );
    }
  }
}

export const summarySkill = new SummarySkill();
