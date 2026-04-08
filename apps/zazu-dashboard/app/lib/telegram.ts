import crypto from 'crypto';

/**
 * Validates the data received from the Telegram Web App.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
export function validateTelegramInitData(initData: string, botToken: string): boolean {
  if (!initData || !botToken) return false;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  // Sort keys alphabetically
  const dataCheckString = Array.from(urlParams.keys())
    .sort()
    .map((key) => `${key}=${urlParams.get(key)}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return calculatedHash === hash;
}

export function parseTelegramUser(initData: string) {
  const urlParams = new URLSearchParams(initData);
  const userJson = urlParams.get('user');
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}
