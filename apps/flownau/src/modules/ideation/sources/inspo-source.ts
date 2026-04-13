import axios from 'axios'
import { logger, logError } from '@/modules/shared/logger'

interface InspoItem {
  id: string
  type: string
  note: string | null
  extractedHook: string | null
  extractedTheme: string | null
  adaptedScript: string | null
  postCaption?: string | null
  postTranscript?: string | null
}

const NAUTHENTICITY_TIMEOUT_MS = 10_000

/**
 * Fetches InspoItems from nauthenticity for content ideation.
 *
 * Graceful degradation: returns empty array + logs warning if
 * nauthenticity is unreachable or returns an error.
 */
export async function fetchInspoItems(accountId: string): Promise<InspoItem[]> {
  const baseUrl = process.env.NAUTHENTICITY_URL
  if (!baseUrl) {
    logger.warn('[InspoSource] NAUTHENTICITY_URL not configured — skipping InspoItems')
    return []
  }

  const serviceKey = process.env.NAU_SERVICE_KEY
  if (!serviceKey) {
    logger.warn('[InspoSource] NAU_SERVICE_KEY not configured — cannot call nauthenticity')
    return []
  }

  try {
    const response = await axios.get<{ items: InspoItem[] }>(`${baseUrl}/api/v1/content/search`, {
      params: { accountId, status: 'unused', limit: 20 },
      headers: { 'x-service-key': serviceKey },
      timeout: NAUTHENTICITY_TIMEOUT_MS,
    })

    const items = response.data?.items ?? []
    logger.info(`[InspoSource] Fetched ${items.length} InspoItems for account ${accountId}`)
    return items
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
        logger.warn(`[InspoSource] nauthenticity unreachable (${err.code}) — degrading gracefully`)
      } else {
        logError('[InspoSource] nauthenticity API error', err)
      }
    } else {
      logError('[InspoSource] Unexpected error fetching InspoItems', err)
    }
    return []
  }
}
