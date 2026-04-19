import axios from 'axios'
import { logger, logError } from '@/modules/shared/logger'

export interface BrandDigest {
  content: string
  attachedUrls: string[]
}

const NAUTHENTICITY_TIMEOUT_MS = 30_000 // Digest may trigger an LLM call — allow up to 30s

/**
 * Fetches the mechanical InspoBase Digest from nauthenticity for a brand.
 *
 * On every 3rd call nauthenticity will run an LLM synthesis — this call can
 * take longer than a normal API request, hence the 30s timeout.
 *
 * Graceful degradation: returns null + logs warning when nauthenticity is
 * unreachable or returns an error.
 */
export async function fetchBrandDigest(brandId: string): Promise<BrandDigest | null> {
  const baseUrl = process.env.NAUTHENTICITY_URL
  if (!baseUrl) {
    logger.warn('[InspoSource] NAUTHENTICITY_URL not configured — skipping brand digest')
    return null
  }

  const serviceKey = process.env.NAU_SERVICE_KEY
  if (!serviceKey) {
    logger.warn('[InspoSource] NAU_SERVICE_KEY not configured — cannot call nauthenticity')
    return null
  }

  try {
    const response = await axios.get<BrandDigest>(`${baseUrl}/api/v1/inspo/digest`, {
      params: { brandId },
      headers: { 'x-nau-service-key': serviceKey },
      timeout: NAUTHENTICITY_TIMEOUT_MS,
    })

    const digest = response.data
    if (!digest || typeof digest.content !== 'string') {
      logger.warn(`[InspoSource] Unexpected digest response shape for brand ${brandId}`)
      return null
    }

    logger.info(
      `[InspoSource] Fetched brand digest for ${brandId} (${digest.attachedUrls.length} attached URLs)`,
    )
    return digest
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
        logger.warn(`[InspoSource] nauthenticity unreachable (${err.code}) — degrading gracefully`)
      } else {
        logError('[InspoSource] nauthenticity API error fetching digest', err)
      }
    } else {
      logError('[InspoSource] Unexpected error fetching brand digest', err)
    }
    return null
  }
}
