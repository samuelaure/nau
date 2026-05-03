import { z } from 'zod';
import type { StorageConfig } from './types';

export const storageEnvSchema = z.object({
  R2_ENDPOINT: z.string().url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.string().url(),
  R2_ENV_PREFIX: z.string().min(1).default('dev'),
});

export type StorageEnv = z.infer<typeof storageEnvSchema>;

/**
 * Reads and validates R2 env vars from process.env.
 * Call once at app startup; exits on missing/invalid vars.
 */
export function loadStorageConfig(): StorageConfig {
  const result = storageEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Missing or invalid R2 storage environment variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  const env = result.data;

  return {
    endpoint: env.R2_ENDPOINT,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    publicUrl: env.R2_PUBLIC_URL.endsWith('/')
      ? env.R2_PUBLIC_URL.slice(0, -1)
      : env.R2_PUBLIC_URL,
    envPrefix: env.R2_ENV_PREFIX,
  };
}
