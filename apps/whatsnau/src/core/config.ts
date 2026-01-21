import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Platform
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  // WhatsApp Cloud API
  WHATSAPP_VERSION: z.string().default('v18.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default('test_id'),
  WHATSAPP_PHONE_NUMBER: z.string().default('+34600000000'),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default('test_biz_id'),
  WHATSAPP_ACCESS_TOKEN: z.string().default('test_token'),
  WHATSAPP_VERIFY_TOKEN: z.string().default('test_verify'),

  // OpenAI
  OPENAI_API_KEY: z.string().default('test_openai_key'),
  PRIMARY_AI_MODEL: z.string().default('gpt-4o'),
  CHEAP_AI_MODEL: z.string().default('gpt-4o-mini'),
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().default('super-secret-change-me-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

const isTest = process.env.NODE_ENV === 'test';
const parsed = configSchema.safeParse(process.env);

if (!parsed.success && !isTest) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.success ? parsed.data : configSchema.parse({});
