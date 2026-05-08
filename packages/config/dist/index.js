"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNIT_COSTS = exports.z = exports.baseNextSchema = exports.baseApiSchema = exports.ConfigError = void 0;
exports.createConfig = createConfig;
exports.estimateCostUsd = estimateCostUsd;
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
// ── LLM cost rates (USD per 1M tokens) ─────────────────────────────────────
// Source: OpenAI pricing page (2025-04). Update as pricing changes.
exports.UNIT_COSTS = {
    'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
    'gpt-4o-2024-08-06': { inputPer1M: 2.5, outputPer1M: 10.0 },
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
    'text-embedding-3-small': { inputPer1M: 0.02, outputPer1M: 0 },
    'text-embedding-3-large': { inputPer1M: 0.13, outputPer1M: 0 },
    'whisper-1': { inputPer1M: 0, outputPer1M: 0 }, // billed per minute, not tokens
};
function estimateCostUsd(model, promptTokens, completionTokens) {
    const rates = exports.UNIT_COSTS[model];
    if (!rates)
        return undefined;
    return ((promptTokens * rates.inputPer1M + completionTokens * rates.outputPer1M) / 1000000);
}
//# sourceMappingURL=index.js.map