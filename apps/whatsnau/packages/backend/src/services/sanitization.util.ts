/**
 * Sanitization utility for Telegram alerts
 * Redacts sensitive information before sending to external notification channels
 */

const SENSITIVE_KEY_PATTERN = /(token|password|secret|key|auth|credential)/i;

/**
 * Redacts a phone number to show only last 3 digits
 * @example "+34600111222" → "+34***222"
 */
function redactPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '[REDACTED]';
  if (phone.length <= 3) return '***';
  return phone.slice(0, 3) + '***' + phone.slice(-3);
}

/**
 * Redacts a WhatsApp ID to show only prefix
 * @example "wamid.ABC123XYZ" → "wa***"
 */
function redactWhatsAppId(id: string | undefined | null): string {
  if (!id) return '[REDACTED]';
  return 'wa***';
}

/**
 * Redacts message content completely
 */
function redactContent(content: string | undefined | null): string {
  return '[REDACTED]';
}

/**
 * Sanitizes an object by redacting sensitive fields
 * @param obj - Object to sanitize
 * @returns Sanitized copy of the object
 */
export function sanitizeForTelegram(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForTelegram(item));
  }

  // Handle objects
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Redact phone numbers
    if (lowerKey.includes('phone')) {
      sanitized[key] = redactPhoneNumber(value as string);
      continue;
    }

    // Redact WhatsApp IDs
    if (
      lowerKey.includes('whatsappid') ||
      (lowerKey === 'id' && typeof value === 'string' && value.startsWith('wamid'))
    ) {
      sanitized[key] = redactWhatsAppId(value as string);
      continue;
    }

    // Redact message content
    if (
      lowerKey === 'content' ||
      lowerKey === 'message' ||
      lowerKey === 'text' ||
      lowerKey === 'body'
    ) {
      sanitized[key] = redactContent(value as string);
      continue;
    }

    // Redact sensitive keys (tokens, passwords, secrets, etc.)
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForTelegram(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Formats a sanitized context object for Telegram display
 * @param context - Context object to format
 * @returns Formatted string for Telegram message
 */
export function formatContextForTelegram(context: any): string {
  const sanitized = sanitizeForTelegram(context);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(sanitized)) {
    if (value === undefined || value === null) continue;

    // Skip error objects (already shown in main message)
    if (key === 'error') continue;

    // Format the value
    let formattedValue: string;
    if (typeof value === 'object') {
      formattedValue = JSON.stringify(value, null, 2);
    } else {
      formattedValue = String(value);
    }

    lines.push(`<b>${key}:</b> ${formattedValue}`);
  }

  return lines.join('\\n');
}
