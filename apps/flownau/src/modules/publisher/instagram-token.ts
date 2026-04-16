import axios from 'axios'
import { prisma } from '@/modules/shared/prisma'
import { logger, logError } from '@/modules/shared/logger'
import { IG_BASE_URL } from './types'

const REFRESH_BUFFER_DAYS = parseInt(process.env.TOKEN_REFRESH_DAYS_BEFORE_EXPIRY || '7', 10)

interface TokenCheckResult {
  accountId: string
  username: string | null
  status: 'refreshed' | 'valid' | 'expired' | 'error'
  daysUntilExpiry?: number
  error?: string
}

/**
 * Refresh an Instagram long-lived token if it's expiring soon.
 * Returns the valid access token (refreshed or existing).
 */
export async function refreshTokenIfNeeded(account: {
  id: string
  accessToken: string
  tokenExpiresAt: Date | null
}): Promise<string> {
  if (!account.tokenExpiresAt) {
    // No expiry tracked — assume valid
    return account.accessToken
  }

  const now = new Date()
  const msUntilExpiry = account.tokenExpiresAt.getTime() - now.getTime()
  const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24)

  if (daysUntilExpiry > REFRESH_BUFFER_DAYS) {
    return account.accessToken
  }

  if (daysUntilExpiry <= 0) {
    throw new Error(
      `Token for account ${account.id} has already expired (${account.tokenExpiresAt.toISOString()})`,
    )
  }

  logger.info(
    `[TokenRefresh] Refreshing token for account ${account.id} (expires in ${Math.round(daysUntilExpiry)} days)`,
  )

  try {
    const response = await axios.get(`${IG_BASE_URL}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        fb_exchange_token: account.accessToken,
      },
    })

    const newToken: unknown = response.data?.access_token
    const expiresIn: unknown = response.data?.expires_in // seconds

    if (typeof newToken !== 'string' || newToken.length === 0) {
      throw new Error(
        `[TokenRefresh] Instagram API returned no access_token. Response: ${JSON.stringify(response.data)}`,
      )
    }
    if (typeof expiresIn !== 'number') {
      throw new Error(
        `[TokenRefresh] Instagram API returned no expires_in. Response: ${JSON.stringify(response.data)}`,
      )
    }

    const newExpiresAt = new Date(now.getTime() + expiresIn * 1000)

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        accessToken: newToken,
        tokenExpiresAt: newExpiresAt,
        tokenRefreshedAt: now,
      },
    })

    logger.info(
      `[TokenRefresh] Token refreshed for account ${account.id}, new expiry: ${newExpiresAt.toISOString()}`,
    )

    return newToken
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logError(`[TokenRefresh] Failed for account ${account.id}`, err)
    throw new Error(`Token refresh failed: ${msg}`)
  }
}

/**
 * Check and refresh all accounts with expiring tokens.
 * Called by the token-refresh cron.
 */
export async function checkAllTokens(): Promise<TokenCheckResult[]> {
  const results: TokenCheckResult[] = []

  const accounts = await prisma.socialAccount.findMany({
    where: { accessToken: { not: '' } },
    select: {
      id: true,
      username: true,
      accessToken: true,
      tokenExpiresAt: true,
    },
  })

  const now = new Date()

  for (const account of accounts) {
    if (!account.tokenExpiresAt) {
      results.push({
        accountId: account.id,
        username: account.username,
        status: 'valid',
      })
      continue
    }

    const msUntilExpiry = account.tokenExpiresAt.getTime() - now.getTime()
    const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24)

    if (daysUntilExpiry <= 0) {
      results.push({
        accountId: account.id,
        username: account.username,
        status: 'expired',
        daysUntilExpiry: Math.round(daysUntilExpiry),
      })
      continue
    }

    if (daysUntilExpiry <= REFRESH_BUFFER_DAYS) {
      try {
        await refreshTokenIfNeeded(account)
        results.push({
          accountId: account.id,
          username: account.username,
          status: 'refreshed',
          daysUntilExpiry: Math.round(daysUntilExpiry),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({
          accountId: account.id,
          username: account.username,
          status: 'error',
          daysUntilExpiry: Math.round(daysUntilExpiry),
          error: msg,
        })
      }
    } else {
      results.push({
        accountId: account.id,
        username: account.username,
        status: 'valid',
        daysUntilExpiry: Math.round(daysUntilExpiry),
      })
    }
  }

  return results
}

/**
 * Exchange a short-lived Instagram token for a long-lived one (~60 days).
 * Used during the OAuth callback flow.
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<string> {
  const response = await axios.get(`${IG_BASE_URL}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.FB_APP_ID,
      client_secret: process.env.FB_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  })

  const token: unknown = response.data?.access_token
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(
      `[getLongLivedToken] Instagram API returned no access_token. Response: ${JSON.stringify(response.data)}`,
    )
  }
  return token
}
