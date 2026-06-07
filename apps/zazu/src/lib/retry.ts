import { logger } from './logger'

/**
 * Retries an async operation with exponential backoff.
 * Designed for transient network failures (e.g. Telegram "temporarily unavailable").
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const { retries = 3, baseDelayMs = 1000, label = 'operation' } = opts
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        logger.warn({ err, attempt: attempt + 1, retries, delayMs: delay }, `[Retry] ${label} failed, retrying in ${delay}ms`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}
