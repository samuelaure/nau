import { z } from 'zod'

const EnvSchema = z
  .object({
    // Infrastructure
    DATABASE_URL: z.string().url().startsWith('postgres'),
    AUTH_SECRET: z.string().min(32),
    PUBLIC_DOMAIN: z.string().min(1),
    NAU_SERVICE_KEY: z.string().min(1),
    NAUTHENTICITY_URL: z.string().url(),
    CRON_SECRET: z.string().min(1),
    NAU_API_URL: z.string().url(),
    NEXT_PUBLIC_FLOWNAU_URL: z.string().url(),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_ACCOUNTS_URL: z.string().url(),
    AUTH_URL: z.string().url().optional(),
    AUTH_TRUST_HOST: z.string().optional(),

    // Storage (R2)
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_ENDPOINT: z.string().url(),
    R2_BUCKET_NAME: z.string().min(1),
    R2_PUBLIC_URL: z.string().url(),

    // AI Providers
    OPENAI_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),

    // Redis
    REDIS_URL: z.string().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z
      .string()
      .transform((v) => parseInt(v, 10))
      .optional()
      .default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // Parameters
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    RENDER_CONCURRENCY: z
      .string()
      .transform((v) => parseInt(v, 10))
      .default(2),
  })
  .superRefine((data, ctx) => {
    // At least one AI provider required
    if (!data.OPENAI_API_KEY && !data.GROQ_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of OPENAI_API_KEY or GROQ_API_KEY must be set.',
        path: ['AI_PROVIDERS'],
      })
    }

    // At least one Redis config style required
    if (!data.REDIS_URL && !data.REDIS_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of REDIS_URL or REDIS_HOST must be set.',
        path: ['REDIS'],
      })
    }
  })

export type Env = z.infer<typeof EnvSchema>

let cachedEnv: Env | null = null

export function validateEnv(): Env {
  if (cachedEnv) return cachedEnv

  const result = EnvSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const errorMsg = Object.entries(errors)
      .map(([field, msgs]) => `${field}: ${msgs?.join(', ')}`)
      .join('\n')

    throw new Error(`❌ Invalid environment variables:\n${errorMsg}`)
  }

  cachedEnv = result.data
  return cachedEnv
}
