import { Telegraf, Context } from 'telegraf';
import * as dotenv from 'dotenv';
import path from 'path';
import prisma, { OnboardingState, Role } from '@zazu/db';
import { persistenceMiddleware } from './middleware/persistence';
import { llmService } from './llm-service';

// Load environmental variables from root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
  process.exit(1);
}

// Custom Context interface to include our DB user
interface ZazuContext extends Context {
  dbUser: any; // Using any for convenience, but in a full app we'd type it more strictly with Prisma.User
}

const bot = new Telegraf<ZazuContext>(token);

// 1. Persistence & Logging
bot.use(persistenceMiddleware);

// 2. Start Command
bot.start(async (ctx) => {
  const user = ctx.dbUser;
  
  if (user.onboardingState === OnboardingState.AWAITING_NAME && !user.displayName) {
    return ctx.reply('¡Hola! Soy Zazŭ. Antes de empezar, ¿cuál es tu nombre?');
  } else {
    return ctx.reply(`¡Hola de nuevo, ${user.displayName || user.firstName || 'amigo'}! ¿En qué puedo ayudarte hoy?`);
  }
});

// 3. Onboarding & Conversational Logic
bot.on('text', async (ctx) => {
  const user = ctx.dbUser;
  const message = ctx.message.text;

  // Handle Onboarding State: AWAITING_NAME
  if (user.onboardingState === OnboardingState.AWAITING_NAME && !user.displayName) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName: message,
        onboardingState: OnboardingState.COMPLETED,
      },
    });
    return ctx.reply(`¡Encantado de conocerte, ${message}! Estoy aquí para ayudarte con lo que necesites.`);
  }

  // Handle Conversational Fallback (If no features are active)
  if (user.onboardingState === OnboardingState.COMPLETED && (!user.features || user.features.length === 0)) {
    // Get last few messages for context
    const recentMessages = await prisma.message.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6, // Last 3 exchanges
    });

    const llmMessages = recentMessages
      .reverse()
      .map((msg: any) => ({
        role: (msg.role === Role.USER ? 'user' : 'assistant') as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

    // Generate response
    const response = await llmService.getConversationalResponse(llmMessages);

    return ctx.reply(response.content);
  }

  // Fallback for unexpected cases
  return ctx.reply('Entendido. ¿Necesitas algo más?');
});

bot.launch().then(() => {
  console.log('✅ Zazŭ Bot is online and listening in Spanish...');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
