import { ZazuSkill, ZazuContext } from '@zazu/skills-core';
import axios from 'axios';

export class TriageSkill implements ZazuSkill {
  id = 'core-triage';
  name = 'Triage Core Engine';
  priority = 100; // High priority, runs before conversational fallback

  async canHandle(ctx: ZazuContext): Promise<boolean> {
    const user = ctx.dbUser;
    
    if (!ctx.textContent) return false;
    
    // We only triage voice messages by default (or explicitly tagged text)
    const isVoice = ctx.message && 'voice' in ctx.message;
    const hasTag = ctx.textContent.toLowerCase().includes('#triage');
    
    return user?.onboardingState === 'COMPLETED' && (!!isVoice || !!hasTag);
  }

  async handle(ctx: ZazuContext): Promise<void> {
    if (!ctx.textContent) return;

    // Acknowledge receipt
    const waitMsg = await ctx.reply('⏳ Procesando y enviando a tu Segunda Base (9naŭ)...');

    try {
      const response = await axios.post(
        `${process.env.NAU_API_URL || 'http://localhost:3000'}/api/triage`,
        {
          text: ctx.textContent,
          userId: ctx.dbUser.telegramId || ctx.dbUser.id?.toString()
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.NAU_SERVICE_KEY}`
          }
        }
      );

      const result = response.data;
      
      if (result.success && result.rawResult) {
        // Format structured response
        const { segments, journalSummary } = result.rawResult;
        
        let message = `📝 *Nota de voz procesada:*\n`;
        
        const categoryCounts: Record<string, number> = {};
        for (const seg of segments) {
          categoryCounts[seg.category] = (categoryCounts[seg.category] || 0) + 1;
        }

        const icons: Record<string, string> = {
          action: '✅',
          project: '📋',
          habit: '🔄',
          appointment: '📅',
          someday_maybe: '💭',
          reference: '📚',
          content_idea: '💡'
        };

        for (const [cat, count] of Object.entries(categoryCounts)) {
           message += `${icons[cat] || '•'} ${count} ${cat.replace('_', ' ')}\n`;
        }

        if (journalSummary) {
          message += `📓 Entrada de diario guardada\n`;
        }

        const actions = segments.filter((s: any) => s.category === 'action');
        if (actions.length > 0) {
          message += `\n*Acciones detectadas:*\n`;
          actions.forEach((a: any) => {
            message += `• ${a.text}\n`;
          });
        }

        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          waitMsg.message_id,
          undefined,
          message,
          { parse_mode: 'Markdown' } // To render bold properly
        );
      } else {
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          waitMsg.message_id,
          undefined,
          '⚠️ Se guardó tu nota, pero el triage no pudo clasificarla.'
        );
      }
    } catch (error) {
      console.error('Error contacting triage API:', error);
      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        waitMsg.message_id,
        undefined,
        '⚠️ Error de conexión con 9naŭ. Guardé la nota de voz; el triage automátco está pausado.'
      );
    }
  }
}

export const triageSkill = new TriageSkill();
