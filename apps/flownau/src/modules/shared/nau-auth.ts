import { logger } from '@/modules/shared/logger'

/**
 * Validates the NAU_SERVICE_KEY for cross-service API authentication.
 * Used on all /api/v1/* routes (except /health).
 *
 * Expects the key in the 'x-service-key' header.
 * Returns true if valid, false if invalid or missing.
 */
export function validateServiceKey(request: Request): boolean {
  const serviceKey = process.env.NAU_SERVICE_KEY
  if (!serviceKey) {
    logger.error('NAU_SERVICE_KEY is not configured in environment variables')
    return false
  }

  const providedKey = request.headers.get('x-nau-service-key')
  if (!providedKey) {
    return false
  }

  return providedKey === serviceKey
}

/**
 * Standard 401 response for unauthorized cross-service requests.
 */
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized: invalid or missing x-service-key header' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  )
}

/**
 * Validates the CRON_SECRET for internal cron route protection.
 * Supports standard 'Authorization: Bearer <secret>' or the Vercel-style
 * 'Authorization: Bearer <secret>' automatically.
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
