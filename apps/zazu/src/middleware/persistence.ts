import { Context, Middleware } from 'telegraf';
import prisma, { Role, OnboardingState } from '@zazu/db';

export const persistenceMiddleware: Middleware<Context> = async (ctx, next) => {
  const telegramId = ctx.from?.id;
  const chatType = ctx.chat?.type;

  // Only handle private messages for user persistence for now
  if (!telegramId || chatType !== 'private') return next();

  // 1. Ensure User exists and update metadata
  const user = await prisma.user.upsert({
    where: { telegramId: BigInt(telegramId) },
    update: {
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
    },
    create: {
      telegramId: BigInt(telegramId),
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      onboardingState: OnboardingState.AWAITING_NAME,
    },
    include: {
      features: true,
    },
  });

  // Attach user to context for convenience
  (ctx as any).dbUser = user;

  // 2. Log incoming message if it exists
  if (ctx.message && 'text' in ctx.message) {
    await prisma.message.create({
      data: {
        userId: user.id,
        role: Role.USER,
        content: ctx.message.text,
        metadata: {
          telegramMessageId: ctx.message.message_id,
        },
      },
    });
  }

  // Wrap ctx.reply to log outgoing messages
  const originalReply = ctx.reply.bind(ctx);
  ctx.reply = async (text: string, extra?: any) => {
    const response = await originalReply(text, extra);
    await prisma.message.create({
      data: {
        userId: user.id,
        role: Role.ASSISTANT,
        content: text,
        metadata: {
          responseMessageId: response.message_id,
        },
      },
    });
    return response;
  };

  return next();
};
