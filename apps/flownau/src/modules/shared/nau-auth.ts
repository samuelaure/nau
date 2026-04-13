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

  const providedKey = request.headers.get('x-service-key')
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
