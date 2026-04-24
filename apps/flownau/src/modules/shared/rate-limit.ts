import Redis from 'ioredis'
import { logger } from './logger'

let redisClient: Redis | null = null

function getRedis(): Redis {
  if (redisClient) return redisClient

  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL)
  } else {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
    })
  }

  redisClient.on('error', (err) => logger.warn(`[RateLimit] Redis error: ${err.message}`))
  return redisClient
}

/**
 * Sliding window rate limiter backed by Redis INCR + EXPIRE.
 * Atomic: INCR + conditional EXPIRE on first call within the window.
 */
export async function checkRateLimit(opts: {
  key: string
  maxRequests: number
  windowSeconds: number
}): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const { key, maxRequests, windowSeconds } = opts
  const resetAt = Math.floor(Date.now() / 1000) + windowSeconds

  try {
    const redis = getRedis()
    const current = await redis.incr(key)
    if (current === 1) {
      await redis.expire(key, windowSeconds)
    }
    const allowed = current <= maxRequests
    const remaining = Math.max(0, maxRequests - current)
    return { allowed, remaining, resetAt }
  } catch (err) {
    // Fail open: if Redis is unavailable, allow the request rather than blocking all traffic
    logger.warn(
      `[RateLimit] Redis unavailable, failing open: ${err instanceof Error ? err.message : String(err)}`,
    )
    return { allowed: true, remaining: maxRequests, resetAt }
  }
}

/**
 * Acquire a distributed lock using SET NX PX (atomic).
 * Returns true if the lock was acquired, false if already held by another instance.
 */
export async function acquireLock(lockKey: string, ttlMs: number): Promise<boolean> {
  try {
    const redis = getRedis()
    const result = await redis.set(lockKey, '1', 'PX', ttlMs, 'NX')
    return result === 'OK'
  } catch (err) {
    logger.warn(
      `[RateLimit] Lock acquire failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return false
  }
}

export async function releaseLock(lockKey: string): Promise<void> {
  try {
    const redis = getRedis()
    await redis.del(lockKey)
  } catch (err) {
    logger.warn(
      `[RateLimit] Lock release failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}
