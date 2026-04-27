import axios from 'axios'
import { signServiceToken } from '@nau/auth'
import { logger, logError } from '@/modules/shared/logger'

export interface BrandDigest {
  content: string
  attachedUrls: string[]
}

const NAUTHENTICITY_TIMEOUT_MS = 30_000

export async function fetchBrandDigest(brandId: string): Promise<BrandDigest | null> {
  const baseUrl = process.env.NAUTHENTICITY_URL
  const authSecret = process.env.AUTH_SECRET
  if (!baseUrl) {
    logger.warn('[InspoSource] NAUTHENTICITY_URL not configured — skipping brand digest')
    return null
  }
  if (!authSecret) {
    logger.warn('[InspoSource] AUTH_SECRET not configured — cannot call nauthenticity')
    return null
  }

  try {
    const token = await signServiceToken({ secret: authSecret, iss: 'flownau', aud: 'nauthenticity' })
    const response = await axios.get<BrandDigest>(
      `${baseUrl}/_service/brands/${encodeURIComponent(brandId)}/inspo/digest`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: NAUTHENTICITY_TIMEOUT_MS,
      },
    )

    const digest = response.data
    if (!digest || typeof digest.content !== 'string') {
      logger.warn(`[InspoSource] Unexpected digest response shape for brand ${brandId}`)
      return null
    }

    if (!digest.content.trim()) {
      logger.info(`[InspoSource] No InspoItems for brand ${brandId} — using DNA-only mode`)
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
