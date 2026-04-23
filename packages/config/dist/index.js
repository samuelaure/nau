"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.z = exports.baseNextSchema = exports.baseApiSchema = exports.ConfigError = void 0;
exports.createConfig = createConfig;
const zod_1 = require("zod");
Object.defineProperty(exports, "z", { enumerable: true, get: function () { return zod_1.z; } });
class ConfigError extends Error {
    constructor(issues) {
        const lines = issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
        super(`Invalid environment configuration:\n${lines.join('\n')}`);
        this.name = 'ConfigError';
    }
}
exports.ConfigError = ConfigError;
function createConfig(schema) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
        throw new ConfigError(result.error.issues);
    }
    return result.data;
}
// ── Shared base schemas ────────────────────────────────────────────────────────
exports.baseApiSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_URL: zod_1.z.string().url(),
    NAU_API_URL: zod_1.z.string().url(),
    AUTH_SECRET: zod_1.z.string().min(32),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
});
exports.baseNextSchema = zod_1.z.object({
    NEXT_PUBLIC_APP_URL: zod_1.z.string().url(),
    NAU_API_URL: zod_1.z.string().url(),
    AUTH_SECRET: zod_1.z.string().min(32),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
});
//# sourceMappingURL=index.js.map