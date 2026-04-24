import { verifyServiceToken, extractBearerToken, AuthError } from '@nau/auth'
import { logger } from '@/modules/shared/logger'

/**
 * Validates an inbound service JWT on /api/v1/* routes.
 * Callers must present `Authorization: Bearer <jwt>` signed with AUTH_SECRET,
 * issued by any known service (iss), addressed to 'flownau' (aud).
 */
export async function validateServiceToken(request: Request): Promise<boolean> {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    logger.error('AUTH_SECRET is not configured')
    return false
  }

  const token = extractBearerToken(request.headers.get('authorization') ?? undefined)
  if (!token) return false

  try {
    await verifyServiceToken(token, secret)
    return true
  } catch (err) {
    if (err instanceof AuthError) {
      logger.warn(`Service auth failed: ${err.message}`)
    }
    return false
  }
}

/**
 * Standard 401 response for unauthorized cross-service requests.
 */
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized: missing or invalid service token' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  )
}

/**
 * Validates the CRON_SECRET for internal cron route protection.
 */
export function validateCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    logger.error('CRON_SECRET is not configured in environment variables')
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const providedSecret = authHeader.substring(7)
  return providedSecret === cronSecret
}

/**
 * Standard 401 response for unauthorized cron requests.
 */
export function unauthorizedCronResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized: invalid or missing Bearer token in Authorization header',
    }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  )
}
