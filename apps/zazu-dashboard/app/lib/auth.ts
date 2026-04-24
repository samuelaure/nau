import { validateTelegramInitData, parseTelegramUser } from './telegram';

export async function getSession(headers: Headers) {
  const initData = headers.get('x-telegram-init-data');
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!initData || !botToken) return null;

  const isValid = validateTelegramInitData(initData, botToken);
  if (!isValid) return null;

  const user = parseTelegramUser(initData);
  return { user };
}

export async function validateSessionOrDie(headers: Headers) {
  const session = await getSession(headers);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}
