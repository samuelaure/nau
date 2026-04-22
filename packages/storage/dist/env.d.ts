import { z } from 'zod';
import type { StorageConfig } from './types';
export declare const storageEnvSchema: z.ZodObject<{
    R2_ENDPOINT: z.ZodString;
    R2_ACCESS_KEY_ID: z.ZodString;
    R2_SECRET_ACCESS_KEY: z.ZodString;
    R2_BUCKET_NAME: z.ZodString;
    R2_PUBLIC_URL: z.ZodString;
}, z.core.$strip>;
export type StorageEnv = z.infer<typeof storageEnvSchema>;
/**
 * Reads and validates R2 env vars from process.env.
 * Call once at app startup; exits on missing/invalid vars.
 */
export declare function loadStorageConfig(): StorageConfig;
//# sourceMappingURL=env.d.ts.map