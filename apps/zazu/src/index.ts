import * as dotenv from 'dotenv';
import path from 'path';
import { ProactiveDeliverySystem } from './proactive-delivery';
import { logger } from './lib/logger';
import { buildServiceHeaders } from './lib/service-auth';

// Fallback env load for when the process is started without dotenv-cli
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { Telegraf, session } from 'telegraf';
import prisma, { OnboardingState } from '@zazu/db';
import { ZazuContext } from '@zazu/skills-core';
import { persistenceMiddleware } from './middleware/persistence';
import { voicePreprocessor } from './middleware/voice-preprocessor';
import { skillManager } from './skill-manager';
import { ConversationalSkill } from '@zazu/feature-conversational';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  logger.fatal('TELEGRAM_BOT_TOKEN is not defined in environment variables');
  process.exit(1);
}

const bot = new Telegraf<ZazuContext>(token);

// --- 1. Skill Registration ---
import { triageSkill } from './triage-skill';
import { summarySkill } from './summary-skill';
import { voicenoteSkill, buildBrandKeyboard, buildWorkspaceKeyboard } from './voicenote-skill';
import type { Brand, Workspace } from './voicenote-skill';
skillManager.register(voicenoteSkill);
skillManager.register(triageSkill);
skillManager.register(summarySkill);
skillManager.register(new ConversationalSkill());

// --- 2. Middlewares ---
bot.use(session());
bot.use(persistenceMiddleware);
bot.use(voicePreprocessor);

// --- 3. Start Command ---
bot.start(async (ctx) => {
  const user = ctx.dbUser;

  if (user.onboardingState === OnboardingState.AWAITING_NAME && !user.displayName) {
    return ctx.reply('¡Hola! Soy Zazŭ. Antes de empezar, ¿cuál es tu nombre?');
  }

  if (!user.nauUserId) {
    return sendLinkPrompt(ctx, user);
  }

  return ctx.reply(`¡Hola de nuevo, ${user.displayName || user.firstName || 'amigo'}! ¿En qué puedo ayudarte hoy?`);
});

// --- /link Command ---
bot.command('link', async (ctx) => {
  if (ctx.dbUser.nauUserId) {
    return ctx.reply('✅ Tu cuenta naŭ ya está vinculada. No necesitas hacer nada más.');
  }
  return sendLinkPrompt(ctx, ctx.dbUser);
});

async function sendLinkPrompt(ctx: any, user: any): Promise<void> {
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://api:3000';
  const accountsUrl = process.env.ACCOUNTS_URL ?? 'https://accounts.9nau.com';

  try {
    const headers = await buildServiceHeaders('9nau-api');
    const resp = await fetch(`${nauApiUrl}/auth/link-token/bot`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ telegramId: user.telegramId.toString() }),
    });

    if (!resp.ok) throw new Error(`link-token API returned ${resp.status}`);
    const { token } = await resp.json() as { token: string };
    const linkUrl = `${accountsUrl}/telegram/link?token=${token}`;

    return ctx.reply(
      `¡Hola, ${user.firstName || 'amigo'}! 👋\n\nPara recibir notificaciones de naŭ Platform y enviar ideas de voz, vincula tu cuenta:\n\n👉 [Vincular cuenta naŭ](${linkUrl})\n\n_El enlace expira en 15 minutos. Si expira, escribe /link para generar uno nuevo._`,
      { parse_mode: 'Markdown' }
    );
  } catch {
    return ctx.reply('❌ No se pudo generar el enlace de vinculación. Intenta de nuevo con /link.');
  }
}

// --- 4. Callback Handlers ---
bot.on('callback_query', async (ctx) => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const data = ctx.callbackQuery.data;
  if (!data) return;

  // ── Triage brand selection ──
  if (data.startsWith('triage_brand:')) {
    await ctx.answerCbQuery();
    const brandToken = data.replace('triage_brand:', '');
    const brandId = brandToken === 'auto' ? null : brandToken;
    const text: string | undefined = ctx.session?.pendingTriageText;
    if (!text) {
      await ctx.editMessageText('⚠️ No encontré el texto pendiente. Envía el mensaje de voz de nuevo.');
      return;
    }
    ctx.session.pendingTriageText = undefined;
    ctx.session.pendingTriageUserId = undefined;
    const label = brandId ? `marca seleccionada` : `auto-detección de marca`;
    await ctx.editMessageText(`⏳ Procesando con ${label}...`);
    await triageSkill.runTriage(ctx as any, text, brandId);
    return;
  }

  // ── Voicenote triage flow ──
  if (data.startsWith('vnote_')) {
    await ctx.answerCbQuery();

    // ── Step 1: Intent selection (Journal / Content) ──────────────────────────
    if (data === 'vnote_triage_journal' || data === 'vnote_triage_content') {
      const intent = data === 'vnote_triage_journal' ? 'journal' : 'content';
      let intents: string[] = ctx.session?.selectedVoicenoteIntents ?? [];
      intents = intents.includes(intent)
        ? intents.filter((i) => i !== intent)
        : [...intents, intent];
      ctx.session.selectedVoicenoteIntents = intents;

      await ctx.editMessageReplyMarkup({
        inline_keyboard: [
          [{ text: intents.includes('journal') ? '✅ 📓 Diario (Journal)' : '☐ 📓 Diario (Journal)', callback_data: 'vnote_triage_journal' }],
          [{ text: intents.includes('content') ? '✅ 💡 Idea de Contenido' : '☐ 💡 Idea de Contenido', callback_data: 'vnote_triage_content' }],
          [{ text: '▶️ Confirmar', callback_data: 'vnote_triage_confirm' }],
        ],
      });
      return;
    }

    // ── Step 1 confirm: Route based on selected intents ───────────────────────
    if (data === 'vnote_triage_confirm') {
      const intents: string[] = ctx.session?.selectedVoicenoteIntents ?? [];
      if (intents.length === 0) {
        await ctx.answerCbQuery('Selecciona al menos una opción.');
        return;
      }

      const workspaces: Array<{ id: string; name: string }> = ctx.session?.pendingVoicenoteWorkspaces ?? [];
      const brands: Array<{ id: string; name: string }> = ctx.session?.pendingVoicenoteBrands ?? [];
      const cleanTranscription: string = ctx.session?.pendingVoicenoteClean ?? '';
      const voicenoteId: string = ctx.session?.pendingVoicenoteId ?? '';
      const isJournal = intents.includes('journal');
      const isContent = intents.includes('content');
      const isBoth = isJournal && isContent;

      // ── BOTH: Run LLM split first, then chain the selection steps
      if (isBoth) {
        await ctx.editMessageText('⏳ Separando ideas y reflexiones...');
        try {
          const split = await voicenoteSkill.splitIntent(cleanTranscription);
          ctx.session.pendingVoicenoteSplitJournal = split.journal_entry ?? cleanTranscription;
          ctx.session.pendingVoicenoteSplitContent = split.content_idea ?? cleanTranscription;
        } catch (err) {
          logger.error({ err }, '[VoicenoteSkill] split-intent LLM failed, falling back to full text');
          ctx.session.pendingVoicenoteSplitJournal = cleanTranscription;
          ctx.session.pendingVoicenoteSplitContent = cleanTranscription;
        }

        // Next: workspace selection (or auto-select if only one)
        if (workspaces.length <= 1) {
          ctx.session.selectedVoicenoteWorkspaceIds = workspaces.map((w) => w.id);
          // Jump straight to brand selection
          if (brands.length <= 1) {
            ctx.session.selectedVoicenoteBrandIds = brands.map((b) => b.id);
            await handleBothDispatch(ctx);
          } else {
            await ctx.editMessageText('💡 ¿A qué marca(s) enviamos la idea de contenido?');
            await ctx.reply('Selecciona marca(s):', {
              reply_markup: buildBrandKeyboard(brands, []),
            });
          }
        } else {
          await ctx.editMessageText('📓 ¿A qué espacio de trabajo va la entrada de diario?');
          await ctx.reply('Selecciona espacio(s):', {
            reply_markup: buildWorkspaceKeyboard(workspaces, []),
          });
        }
        return;
      }

      // ── JOURNAL only ──────────────────────────────────────────────────────
      if (isJournal) {
        if (workspaces.length === 0) {
          await ctx.editMessageText('⚠️ No tienes espacios de trabajo configurados.');
          return;
        }
        if (workspaces.length === 1) {
          // Auto-select and dispatch immediately
          await ctx.editMessageText('⏳ Guardando entrada de diario...');
          await dispatchJournalAndFinish(ctx, workspaces[0].id);
        } else {
          await ctx.editMessageText('📓 ¿A qué espacio de trabajo va esta entrada?');
          await ctx.reply('Selecciona espacio(s):', {
            reply_markup: buildWorkspaceKeyboard(workspaces, []),
          });
        }
        return;
      }

      // ── CONTENT only ──────────────────────────────────────────────────────
      if (isContent) {
        if (brands.length === 0) {
          await ctx.editMessageText('⚠️ No tienes marcas configuradas. Crea una marca primero.');
          return;
        }
        if (brands.length === 1) {
          // Auto-select and dispatch immediately
          await ctx.editMessageText(`⏳ Enviando captura a *${brands[0].name}*\\.\\.\\.`);
          const results = await voicenoteSkill.dispatchToBrands(voicenoteId, cleanTranscription, ctx.session.pendingVoicenoteSynthesis, brands);
          clearVoicenoteSession(ctx);
          const summaryLines = results.map((r) => `- ${r.ideaCount} nuevas ideas para ${r.brandName}`).join('\n');
          await ctx.editMessageText(`✅ Captura enviada. Se generaron:\n${summaryLines}`);
        } else {
          await ctx.editMessageText('💡 ¿A qué marca(s) enviamos esta captura?');
          await ctx.reply('Selecciona marca(s):', {
            reply_markup: buildBrandKeyboard(brands, []),
          });
        }
        return;
      }
    }

    // ── Step 2a: Workspace multi-select ───────────────────────────────────────
    if (data.startsWith('vnote_ws_') && data !== 'vnote_ws_confirm') {
      const workspaceId = data.replace('vnote_ws_', '');
      const workspaces: Array<{ id: string; name: string }> = ctx.session?.pendingVoicenoteWorkspaces ?? [];
      let selected: string[] = ctx.session?.selectedVoicenoteWorkspaceIds ?? [];
      selected = selected.includes(workspaceId)
        ? selected.filter((id) => id !== workspaceId)
        : [...selected, workspaceId];
      ctx.session.selectedVoicenoteWorkspaceIds = selected;
      await ctx.editMessageReplyMarkup(buildWorkspaceKeyboard(workspaces, selected));
      return;
    }

    if (data === 'vnote_ws_confirm') {
      const selectedWs: string[] = ctx.session?.selectedVoicenoteWorkspaceIds ?? [];
      if (selectedWs.length === 0) {
        await ctx.answerCbQuery('Selecciona al menos un espacio de trabajo.');
        return;
      }

      const intents: string[] = ctx.session?.selectedVoicenoteIntents ?? [];
      const isBoth = intents.includes('journal') && intents.includes('content');
      const brands: Array<{ id: string; name: string }> = ctx.session?.pendingVoicenoteBrands ?? [];

      if (isBoth) {
        // Workspace confirmed for Both path → now show brand selection
        if (brands.length <= 1) {
          ctx.session.selectedVoicenoteBrandIds = brands.map((b) => b.id);
          await handleBothDispatch(ctx);
        } else {
          await ctx.editMessageText('💡 ¿A qué marca(s) enviamos la idea de contenido?');
          await ctx.reply('Selecciona marca(s):', {
            reply_markup: buildBrandKeyboard(brands, []),
          });
        }
      } else {
        // Journal-only path: dispatch to first selected workspace
        await ctx.editMessageText('⏳ Guardando entrada de diario...');
        await dispatchJournalAndFinish(ctx, selectedWs[0]);
      }
      return;
    }

    // ── Step 2b: Brand multi-select ───────────────────────────────────────────
    const brands: Array<{ id: string; name: string }> = ctx.session?.pendingVoicenoteBrands ?? [];
    let selected: string[] = ctx.session?.selectedVoicenoteBrandIds ?? [];

    if (data === 'vnote_all') {
      selected = brands.map((b) => b.id);
      ctx.session.selectedVoicenoteBrandIds = selected;
      await ctx.editMessageReplyMarkup(buildBrandKeyboard(brands, selected));
      return;
    }

    if (data.startsWith('vnote_brand_')) {
      const brandId = data.replace('vnote_brand_', '');
      selected = selected.includes(brandId)
        ? selected.filter((id) => id !== brandId)
        : [...selected, brandId];
      ctx.session.selectedVoicenoteBrandIds = selected;
      await ctx.editMessageReplyMarkup(buildBrandKeyboard(brands, selected));
      return;
    }

    if (data === 'vnote_confirm') {
      if (selected.length === 0) {
        await ctx.answerCbQuery('Selecciona al menos una marca.');
        return;
      }

      const intents: string[] = ctx.session?.selectedVoicenoteIntents ?? [];
      const isBoth = intents.includes('journal') && intents.includes('content');

      if (isBoth) {
        // Brand confirmed for Both path → dispatch both
        await handleBothDispatch(ctx);
      } else {
        // Content-only path dispatch
        const voicenoteId: string = ctx.session?.pendingVoicenoteId;
        const cleanTranscription: string = ctx.session?.pendingVoicenoteClean;
        const synthesis: string = ctx.session?.pendingVoicenoteSynthesis;
        const selectedBrands = brands.filter((b) => selected.includes(b.id));
        const selectedNames = selectedBrands.map((b) => b.name).join(', ');
        await ctx.editMessageText(`⏳ Enviando captura a: ${selectedNames}...`);
        const results = await voicenoteSkill.dispatchToBrands(voicenoteId, cleanTranscription, synthesis, selectedBrands);
        clearVoicenoteSession(ctx);
        const summaryLines = results.map((r) => `- ${r.ideaCount} nuevas ideas para ${r.brandName}`).join('\n');
        await ctx.editMessageText(`✅ Captura enviada. Se generaron:\n${summaryLines}`);
      }
    }
  }
});

// --- 5. Unified Message Dispatcher ---
bot.on('message', async (ctx) => {
  const user = ctx.dbUser;
  const content = ctx.textContent;

  // Handle Onboarding State: AWAITING_NAME
  if (user.onboardingState === OnboardingState.AWAITING_NAME && !user.displayName && content) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName: content,
        onboardingState: OnboardingState.COMPLETED,
      },
    });
    return ctx.reply(`¡Encantado de conocerte, ${content}! Estoy aquí para ayudarte con lo que necesites.`);
  }

  // Handle all other messages through the Skill Orchestrator
  if (user.onboardingState === OnboardingState.COMPLETED) {
    const handled = await skillManager.dispatch(ctx);
    if (!handled) {
      return ctx.reply('No estoy seguro de cómo ayudarte con eso por ahora. Pronto tendré más habilidades activas.');
    }
    return;
  }

  // Fallback for unexpected cases
  return ctx.reply('Entendido. ¿Necesitas algo más?');
});

// ── Helper: dispatch journal-only path and display success ───────────────────
async function dispatchJournalAndFinish(ctx: ZazuContext, workspaceId: string) {
  const voicenoteId: string = ctx.session?.pendingVoicenoteId ?? '';
  const cleanTranscription: string = ctx.session?.pendingVoicenoteClean ?? '';
  const nauUserId: string = ctx.dbUser?.nauUserId ?? '';
  try {
    await voicenoteSkill.dispatchToJournal(voicenoteId, cleanTranscription, workspaceId, nauUserId);
    clearVoicenoteSession(ctx);
    await ctx.editMessageText('✅ Entrada de diario guardada.');
  } catch (err) {
    logger.error({ err }, '[VoicenoteSkill] Failed to dispatch journal entry');
    await ctx.editMessageText('❌ Error al guardar la entrada de diario. Intenta de nuevo.');
  }
}

// ── Helper: clear all voicenote-related session keys ────────────────────────
function clearVoicenoteSession(ctx: ZazuContext) {
  if (!ctx.session) return;
  ctx.session.pendingVoicenoteId = undefined;
  ctx.session.pendingVoicenoteClean = undefined;
  ctx.session.pendingVoicenoteSynthesis = undefined;
  ctx.session.pendingVoicenoteBrands = undefined;
  ctx.session.pendingVoicenoteWorkspaces = undefined;
  ctx.session.selectedVoicenoteBrandIds = undefined;
  ctx.session.selectedVoicenoteWorkspaceIds = undefined;
  ctx.session.selectedVoicenoteIntents = undefined;
  ctx.session.pendingVoicenoteSplitJournal = undefined;
  ctx.session.pendingVoicenoteSplitContent = undefined;
}

// ── Helper: dispatch both journal and content for the "Both" path ─────────────
async function handleBothDispatch(ctx: ZazuContext) {
  const voicenoteId: string = ctx.session?.pendingVoicenoteId ?? '';
  const synthesis: string = ctx.session?.pendingVoicenoteSynthesis ?? '';
  const nauUserId: string = ctx.dbUser?.nauUserId ?? '';

  const journalText: string = ctx.session?.pendingVoicenoteSplitJournal ?? ctx.session?.pendingVoicenoteClean ?? '';
  const contentText: string = ctx.session?.pendingVoicenoteSplitContent ?? ctx.session?.pendingVoicenoteClean ?? '';

  const selectedWsIds: string[] = ctx.session?.selectedVoicenoteWorkspaceIds ?? [];
  const selectedBrandIds: string[] = ctx.session?.selectedVoicenoteBrandIds ?? [];
  const brands: Brand[] = (ctx.session?.pendingVoicenoteBrands ?? []).filter((b: Brand) => selectedBrandIds.includes(b.id));
  const workspaceId = selectedWsIds[0];

  await ctx.editMessageText('⏳ Guardando diario y enviando ideas de contenido...');

  const [, contentResults] = await Promise.allSettled([
    workspaceId
      ? voicenoteSkill.dispatchToJournal(voicenoteId, journalText, workspaceId, nauUserId)
      : Promise.resolve(),
    brands.length > 0
      ? voicenoteSkill.dispatchToBrands(voicenoteId, contentText, synthesis, brands)
      : Promise.resolve([]),
  ]);

  clearVoicenoteSession(ctx);

  const contentResultData = contentResults.status === 'fulfilled' && Array.isArray(contentResults.value)
    ? contentResults.value as Array<{ brandName: string; ideaCount: number }>
    : [];

  const summaryLines = contentResultData.map((r) => `- ${r.ideaCount} ideas para ${r.brandName}`).join('\n');
  const journalLine = workspaceId ? '📓 Entrada de diario guardada.' : '';
  const contentLine = summaryLines ? `💡 Ideas de contenido:\n${summaryLines}` : '';
  await ctx.editMessageText(`✅ Captura procesada.\n${[journalLine, contentLine].filter(Boolean).join('\n')}`);
}

async function launchBot(retries = 5): Promise<void> {
  try {
    logger.info('Zazŭ Bot Nucleus is online (Modular Mode)');
    await bot.telegram.setChatMenuButton({ menuButton: { type: 'default' } });
    await bot.launch();
  } catch (err: unknown) {
    const is409 = err instanceof Error && err.message.includes('409');
    if (is409 && retries > 0) {
      logger.warn({ retries }, 'Telegram 409 conflict — previous instance still active, retrying in 65s');
      await new Promise(r => setTimeout(r, 65_000));
      return launchBot(retries - 1);
    }
    logger.fatal({ err }, 'Failed to launch bot — exiting');
    process.exit(1);
  }
}

if (process.env.SKIP_TELEGRAM_POLLING === 'true') {
  logger.warn('SKIP_TELEGRAM_POLLING=true — Telegram polling disabled (dev mode). Proactive delivery still active.');
} else {
  launchBot();
}

// --- 6. Proactive Delivery Queue ---
// Replaces the old webhook format with a robust grouped queue that obeys user Delivery Windows
const deliveryGateway = new ProactiveDeliverySystem(bot);
deliveryGateway.start();

// Enable graceful stop
process.once('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  bot.stop('SIGTERM');
});
