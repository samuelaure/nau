import { NextResponse } from 'next/server'
import { checkAllTokens } from '@/modules/publisher/instagram-token'
import { logError, logger } from '@/modules/shared/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/token-refresh
 *
 * Daily cron that proactively refreshes any Instagram token
 * expiring within the configured buffer (default: 7 days).
 */
export async function GET() {
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
  }
}
