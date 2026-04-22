"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageEnvSchema = void 0;
exports.loadStorageConfig = loadStorageConfig;
const zod_1 = require("zod");
exports.storageEnvSchema = zod_1.z.object({
    R2_ENDPOINT: zod_1.z.string().url(),
    R2_ACCESS_KEY_ID: zod_1.z.string().min(1),
    R2_SECRET_ACCESS_KEY: zod_1.z.string().min(1),
    R2_BUCKET_NAME: zod_1.z.string().min(1),
    R2_PUBLIC_URL: zod_1.z.string().url(),
});
/**
 * Reads and validates R2 env vars from process.env.
 * Call once at app startup; exits on missing/invalid vars.
 */
function loadStorageConfig() {
    const result = exports.storageEnvSchema.safeParse(process.env);
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
    };
}
//# sourceMappingURL=env.js.map