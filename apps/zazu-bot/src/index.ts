import * as dotenv from 'dotenv';
import path from 'path';
import { ProactiveDeliverySystem } from './proactive-delivery';
import { logger } from './lib/logger';

// Load environment variables for local development
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

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

// --- 4. Unified Message Dispatcher ---
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
});

// --- 5. Proactive Delivery Queue ---
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
