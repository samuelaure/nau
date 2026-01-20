import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
    // Platform
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.string().default('info'),

    // WhatsApp Cloud API
    WHATSAPP_VERSION: z.string().default('v18.0'),
    WHATSAPP_PHONE_NUMBER_ID: z.string(),
    WHATSAPP_PHONE_NUMBER: z.string(), // Added for direction detection
    WHATSAPP_BUSINESS_ACCOUNT_ID: z.string(),
    WHATSAPP_ACCESS_TOKEN: z.string(),
    WHATSAPP_VERIFY_TOKEN: z.string(),

    // OpenAI
    OPENAI_API_KEY: z.string(),
    PRIMARY_AI_MODEL: z.string().default('gpt-4o'),
    CHEAP_AI_MODEL: z.string().default('gpt-4o-mini'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.format());
    process.exit(1);
}

export const config = parsed.data;
