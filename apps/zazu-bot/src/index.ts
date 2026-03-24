import * as dotenv from 'dotenv';
import path from 'path';
import http from 'http';

// Load environment variables for local development
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { Telegraf } from 'telegraf';
import prisma, { OnboardingState } from '@zazu/db';
import { ZazuContext } from '@zazu/skills-core';
import { persistenceMiddleware } from './middleware/persistence';
import { voicePreprocessor } from './middleware/voice-preprocessor';
import { skillManager } from './skill-manager';
import { ConversationalSkill } from '@zazu/feature-conversational';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
  process.exit(1);
}

const bot = new Telegraf<ZazuContext>(token);

// --- 1. Skill Registration ---
// In a more complex app, we might load these from a config or directory.
skillManager.register(new ConversationalSkill());

// --- 2. Middlewares ---
bot.use(persistenceMiddleware);
bot.use(voicePreprocessor);

// --- 3. Start Command ---
bot.start(async (ctx) => {
  const user = ctx.dbUser;
  
  if (user.onboardingState === OnboardingState.AWAITING_NAME && !user.displayName) {
    return ctx.reply('¡Hola! Soy Zazŭ. Antes de empezar, ¿cuál es tu nombre?');
  } else {
    return ctx.reply(`¡Hola de nuevo, ${user.displayName || user.firstName || 'amigo'}! ¿En qué puedo ayudarte hoy?`);
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
  console.log('✅ Zazŭ Bot Nucleus is online (Modular Mode)...');
});

// --- 5. Internal Orchestrator Server ---
// Simple server to listen for proactive notifications from the worker.
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/internal/notify') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const secret = process.env.AUTH_SECRET || 'zazu_local_secret';

        if (data.secret !== secret) {
          res.statusCode = 403;
          return res.end();
        }

        // Fetch User and Telegram ID
        const user = await prisma.user.findUnique({ where: { id: data.userId } });
        if (user && user.telegramId) {
          const message = `📝 **Nuevo post de @${data.owner}** en la marca **${data.brandName}**\n\n` +
                          `💡 **Sugerencia de comentario:**\n` +
                          `"${data.suggestion}"\n\n` +
                          `🔗 [Ver en Instagram](${data.postUrl})`;
          
          await bot.telegram.sendMessage(user.telegramId.toString(), message, { parse_mode: 'Markdown' });
          
          // Log outgoing message in DB
          await prisma.message.create({
            data: {
              userId: user.id,
              role: 'ASSISTANT', // Using 'ASSISTANT' as the role for the bot
              content: message,
            }
          });
        }
        res.statusCode = 200;
        res.end();
      } catch (err) {
        console.error('[Nucleus] Internal notification error:', err);
        res.statusCode = 500;
        res.end();
      }
    });
  } else {
    res.statusCode = 404;
    res.end();
  }
});

const PORT = Number(process.env.INTERNAL_PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Internal Nucleus Server listening on port ${PORT}`);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
