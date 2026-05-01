/**
 * Standardized result from any Instagram publish operation.
 */
export interface PublishResult {
  success: boolean
  externalId?: string
  permalink?: string
  error?: string
}

/**
 * Common params shared by all Instagram publishers.
 */
export interface IGPublishParams {
  accessToken: string
  igUserId: string
  caption: string
}

/**
 * IG API constants.
 */
export const IG_API_VERSION = 'v21.0'
export const IG_BASE_URL = `https://graph.facebook.com/${IG_API_VERSION}`

/**
 * Max polling attempts before timing out on container processing.
 */
export const MAX_POLL_ATTEMPTS = 60 // 5 minutes at 5s intervals
export const POLL_INTERVAL_MS = 5_000
