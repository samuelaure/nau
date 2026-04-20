import { ZazuSkill, ZazuContext } from '@zazu/skills-core';
import axios from 'axios';
import { logger } from './lib/logger';
import { getCachedBrand, setCachedBrand } from './lib/brand-context-cache';

const NAU_API_URL = process.env.NAU_API_URL || 'http://localhost:3000';
const NAU_SERVICE_KEY = process.env.NAU_SERVICE_KEY || '';

const SERVICE_HEADERS = { 'x-nau-service-key': NAU_SERVICE_KEY };

type NauBrand = { id: string; name: string };
type NauWorkspace = { id: string; name: string; brands: NauBrand[] };

/** Fetch all brands the user has access to via 9naŭ workspaces API. */
async function fetchUserBrands(nauUserId: string): Promise<NauBrand[]> {
  try {
    const res = await axios.get<NauWorkspace[]>(`${NAU_API_URL}/api/workspaces`, {
      headers: { ...SERVICE_HEADERS, 'x-nau-user-id': nauUserId },
    });
    return (res.data ?? []).flatMap((ws) => ws.brands ?? []);
  } catch {
    return [];
  }
}

async function callTriageApi(text: string, userId: string, brandId: string | null) {
  const response = await axios.post(
    `${NAU_API_URL}/api/triage`,
    { text, userId, brandId },
    { headers: SERVICE_HEADERS },
  );
  return response.data;
}

export class TriageSkill implements ZazuSkill {
  id = 'core-triage';
  name = 'Triage Core Engine';
  priority = 100;

  async canHandle(ctx: ZazuContext): Promise<boolean> {
    const user = ctx.dbUser;
    if (!ctx.textContent) return false;
    const isVoice = ctx.message && 'voice' in ctx.message;
    const hasTag = ctx.textContent.toLowerCase().includes('#triage');
    return user?.onboardingState === 'COMPLETED' && (!!isVoice || !!hasTag);
  }

  async handle(ctx: ZazuContext): Promise<void> {
    if (!ctx.textContent) return;

    const user = ctx.dbUser;
    const nauUserId: string | undefined = user?.nauUserId ?? undefined;

    if (!nauUserId) {
      // Not linked — triage without brand context
      await this.runTriage(ctx, ctx.textContent, null);
      return;
    }

    // Check contextual cache first — skip prompt if user just selected a brand
    const cachedBrandId = getCachedBrand(nauUserId);
    if (cachedBrandId) {
      await this.runTriage(ctx, ctx.textContent, cachedBrandId);
      return;
    }

    const brands = await fetchUserBrands(nauUserId);

    if (brands.length === 0) {
      await this.runTriage(ctx, ctx.textContent, null);
      return;
    }

    // Single brand — auto-route silently
    if (brands.length === 1) {
      setCachedBrand(nauUserId, brands[0].id);
      await this.runTriage(ctx, ctx.textContent, brands[0].id);
      return;
    }

    // Multiple brands — prompt user via inline keyboard
    ctx.session.pendingTriageText = ctx.textContent;
    ctx.session.pendingTriageUserId = nauUserId;

    const brandButtons = brands.map((b) => ([{
      text: `🏷️ ${b.name}`,
      callback_data: `triage_brand:${b.id}`,
    }]));

    const keyboard = {
      inline_keyboard: [
        ...brandButtons,
        [{ text: '🔍 Auto-detect (All Brands)', callback_data: 'triage_brand:auto' }],
      ],
    };

    await ctx.reply(
      `📝 *Transcripción lista.* ¿Para qué marca es esta idea?\n\n_"${ctx.textContent.slice(0, 120)}${ctx.textContent.length > 120 ? '…' : ''}"_`,
      { parse_mode: 'Markdown', reply_markup: keyboard },
    );
  }

  async runTriage(ctx: ZazuContext, text: string, brandId: string | null) {
    const user = ctx.dbUser;
    const userId = user?.nauUserId || user?.telegramId?.toString() || user?.id?.toString() || 'default_user';

    // Cache the chosen brand for this user session
    if (brandId && user?.nauUserId) {
      setCachedBrand(user.nauUserId, brandId);
    }

    const waitMsg = await ctx.reply('⏳ Procesando y enviando a tu Segunda Base (9naŭ)...');

    try {
      const result = await callTriageApi(text, userId, brandId);

      if (result.success && result.rawResult) {
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
          content_idea: '💡',
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
          actions.forEach((a: any) => { message += `• ${a.text}\n`; });
        }

        const contentIdeas = segments.filter((s: any) => s.category === 'content_idea');
        if (contentIdeas.length > 0) {
          const aiLinkedCount = contentIdeas.filter((s: any) => s.metadata?.brandId && !brandId).length;
          if (aiLinkedCount > 0) {
            message += `\n🤖 ${aiLinkedCount} idea(s) enrutadas por IA — requieren revisión manual\n`;
          }
        }

        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          waitMsg.message_id,
          undefined,
          message,
          { parse_mode: 'Markdown' },
        );
      } else {
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          waitMsg.message_id,
          undefined,
          '⚠️ Se guardó tu nota, pero el triage no pudo clasificarla.',
        );
      }
    } catch (error) {
      logger.error({ err: error }, 'Error contacting triage API');
      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        waitMsg.message_id,
        undefined,
        '⚠️ Error de conexión con 9naŭ. Guardé la nota de voz; el triage automático está pausado.',
      );
    }
  }
}

export const triageSkill = new TriageSkill();
