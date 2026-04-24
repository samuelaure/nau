import { NextResponse } from 'next/server'
import { checkAllTokens } from '@/modules/publisher/instagram-token'
import { logError, logger } from '@/modules/shared/logger'
import { acquireLock, releaseLock } from '@/modules/shared/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/token-refresh
 *
 * Daily cron that proactively refreshes any Instagram token
 * expiring within the configured buffer (default: 7 days).
 */
const LOCK_KEY = 'cron:token-refresh:lock'
const LOCK_TTL_MS = 300_000 // 5 minutes

import { validateCronSecret, unauthorizedCronResponse } from '@/modules/shared/nau-auth'

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return unauthorizedCronResponse()
  }

  const acquired = await acquireLock(LOCK_KEY, LOCK_TTL_MS)
  if (!acquired) {
    logger.info('[TokenRefresh] Skipped: another instance is already running')
    return NextResponse.json({ message: 'Skipped: another instance running' })
  }

  try {
    logger.info('[TokenRefresh] Starting token refresh check...')
    const results = await checkAllTokens()

    const refreshed = results.filter((r) => r.status === 'refreshed').length
    const expired = results.filter((r) => r.status === 'expired').length
    const errors = results.filter((r) => r.status === 'error').length

    logger.info(
      `[TokenRefresh] Complete: ${results.length} accounts checked, ${refreshed} refreshed, ${expired} expired, ${errors} errors`,
    )

    return NextResponse.json({
      message: 'Token refresh complete',
      total: results.length,
      refreshed,
      expired,
      errors,
      results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logError('[TokenRefresh] Fatal error', error)
    return NextResponse.json({ error: 'Token refresh failed', details: msg }, { status: 500 })
  } finally {
    await releaseLock(LOCK_KEY)
  }
}
