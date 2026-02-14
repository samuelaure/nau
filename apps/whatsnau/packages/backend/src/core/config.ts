import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z
  .object({
    // Platform
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    DASHBOARD_URL: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().url().default('http://localhost:5173')
    ),
    ALLOWED_ORIGINS: z.string().default('http://localhost:5173,https://whatsnau.9nau.com'),
    INITIAL_ADMIN_PASSWORD: z.string().default('admin123'),

    // WhatsApp Cloud API (Tenant-scoped, optional for boot)
    WHATSAPP_VERSION: z.string().default('v18.0'),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_PHONE_NUMBER: z.string().optional(),
    WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    WHATSAPP_VERIFY_TOKEN: z.string().optional(),

    // Meta App (for Embedded Signup) - Optional
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional(),

    // OpenAI (Tenant-scoped, optional for boot)
    OPENAI_API_KEY: z.string().optional(),
    PRIMARY_AI_MODEL: z.string().default('gpt-4o'),
    CHEAP_AI_MODEL: z.string().default('gpt-4o-mini'),

    // Telegram (Hybrid: system bot + tenant chat IDs)
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_SYSTEM_CHAT_ID: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(), // Deprecated, for backward compatibility

    // Auth
    JWT_SECRET: z.string().default('super-secret-change-me-in-production'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // YCloud (Tenant-scoped, optional for boot)
    YCLOUD_API_KEY: z.string().optional(),
    WHATSAPP_PROVIDER: z.enum(['meta', 'ycloud']).default('meta'),
  })
  .refine(
    (data) =>
      data.NODE_ENV !== 'production' || data.JWT_SECRET !== 'super-secret-change-me-in-production',
    {
      message: 'JWT_SECRET must be changed in production',
      path: ['JWT_SECRET'],
    }
  );

const isTest = process.env.NODE_ENV === 'test';
const parsed = configSchema.safeParse(process.env);

if (!parsed.success && !isTest) {
  const error = new Error('Invalid environment variables');
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw error;
}

export const config = parsed.success ? parsed.data : configSchema.parse({});
