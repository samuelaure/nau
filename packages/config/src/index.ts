import { z, ZodObject, ZodRawShape } from 'zod'

export class ConfigError extends Error {
  constructor(issues: z.ZodIssue[]) {
    const lines = issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
    super(`Invalid environment configuration:\n${lines.join('\n')}`)
    this.name = 'ConfigError'
  }
}

export function createConfig<T extends ZodRawShape>(schema: ZodObject<T>): z.infer<ZodObject<T>> {
  const result = schema.safeParse(process.env)
  if (!result.success) {
    throw new ConfigError(result.error.issues)
  }
  return result.data
}

// ── Shared base schemas ────────────────────────────────────────────────────────

export const baseApiSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NAU_API_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export const baseNextSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NAU_API_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export { z }

// ── LLM cost rates (USD per 1M tokens) ─────────────────────────────────────
// Source: OpenAI pricing page (2025-04). Update as pricing changes.

export const UNIT_COSTS: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4o-2024-08-06': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'text-embedding-3-small': { inputPer1M: 0.02, outputPer1M: 0 },
  'text-embedding-3-large': { inputPer1M: 0.13, outputPer1M: 0 },
  'whisper-1': { inputPer1M: 0, outputPer1M: 0 }, // billed per minute, not tokens
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | undefined {
  const rates = UNIT_COSTS[model]
  if (!rates) return undefined
  return (
    (promptTokens * rates.inputPer1M + completionTokens * rates.outputPer1M) / 1_000_000
  )
}
