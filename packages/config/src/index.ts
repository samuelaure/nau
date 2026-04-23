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
