import { validateEnv } from './env-validation'

/**
 * Runs validation on startup.
 * Admin bootstrapping is now handled by 9naŭ API (the platform IdP).
 */
export async function bootstrapSystem() {
  if (process.env.NODE_ENV === 'test') return

  try {
    validateEnv()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    if (process.env.NODE_ENV === 'production') {
      throw err
    }
  }
}
