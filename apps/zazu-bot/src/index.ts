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
  const domain = process.env.BOT_DOMAIN || 'zazu.9nau.com';
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000';

  // Handle OTT account-linking handshake: /start link-{token}
  const startParam: string = (ctx as any).startPayload ?? '';
  if (startParam.startsWith('link-')) {
    const linkToken = startParam.slice('link-'.length);
    try {
      const headers = await buildServiceHeaders('9nau-api');
      const resp = await fetch(`${nauApiUrl}/_service/auth/link-token/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: linkToken, telegramId: user.telegramId.toString() }),
      });
      if (resp.ok) {
        const data = await resp.json() as { ok: boolean };
        if (data.ok) {
          const userResp = await fetch(`${nauApiUrl}/_service/auth/by-telegram/${user.telegramId}`, { headers });
          if (userResp.ok) {
            const found = await userResp.json() as { found: boolean; user?: { id: string } };
            if (found.found && found.user?.id) {
              await prisma.user.update({ where: { id: user.id }, data: { nauUserId: found.user.id } });
            }
          }
          return ctx.reply('✅ ¡Tu cuenta naŭ ha sido vinculada exitosamente con Zazŭ!');
        }
      }
      return ctx.reply('❌ El enlace de vinculación no es válido o ha expirado. Intenta de nuevo desde la app.');
    } catch {
      return ctx.reply('❌ Ocurrió un error al vincular tu cuenta. Por favor intenta de nuevo.');
    }
  }

  // Attempt to link this Telegram user to their 9naŭ account (best-effort, passive)
  if (!user.nauUserId) {
    try {
      const headers = await buildServiceHeaders('9nau-api');
      const resp = await fetch(`${nauApiUrl}/_service/auth/by-telegram/${user.telegramId}`, { headers });
      if (resp.ok) {
        const data = await resp.json() as { found: boolean; user?: { id: string } };
        if (data.found && data.user?.id) {
          await prisma.user.update({ where: { id: user.id }, data: { nauUserId: data.user.id } });
        }
      }
    } catch {
      // Non-critical — log silently
    }
  }

  const keyboard = {
    reply_markup: {
      inline_keyboard: [[{ text: '🛠️ Abrir Panel', web_app: { url: `https://${domain}/` } }]]
    }
  };

  if (user.onboardingState === OnboardingState.AWAITING_NAME && !user.displayName) {
    return ctx.reply('¡Hola! Soy Zazŭ. Antes de empezar, ¿cuál es tu nombre?', keyboard);
  } else {
    return ctx.reply(`¡Hola de nuevo, ${user.displayName || user.firstName || 'amigo'}! ¿En qué puedo ayudarte hoy?`, keyboard);
  }
});

// --- 4. Brand Selection Callback Handler ---
bot.on('callback_query', async (ctx) => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const data = ctx.callbackQuery.data;
  if (!data?.startsWith('triage_brand:')) return;

  await ctx.answerCbQuery();

  const brandToken = data.replace('triage_brand:', '');
  const brandId = brandToken === 'auto' ? null : brandToken;

  const text: string | undefined = ctx.session?.pendingTriageText;

  if (!text) {
    await ctx.editMessageText('⚠️ No encontré el texto pendiente. Envía el mensaje de voz de nuevo.');
    return;
  }

  // Clear pending session state
  ctx.session.pendingTriageText = undefined;
  ctx.session.pendingTriageUserId = undefined;

  const label = brandId ? `marca seleccionada` : `auto-detección de marca`;
  await ctx.editMessageText(`⏳ Procesando con ${label}...`);

  await triageSkill.runTriage(ctx as any, text, brandId);
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

bot.launch().then(() => {
  logger.info('Zazŭ Bot Nucleus is online (Modular Mode)');
  const domain = process.env.BOT_DOMAIN || 'zazu.9nau.com';
  
  // Set the default Menu Button
  fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'Panel',
        web_app: { url: `https://${domain}/` }
      }
    })
  }).catch(e => logger.error({ err: e }, 'Error setting menu button'));
}).catch((err: unknown) => {
  logger.fatal({ err }, 'Failed to launch bot — exiting')
  process.exit(1)
});

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
