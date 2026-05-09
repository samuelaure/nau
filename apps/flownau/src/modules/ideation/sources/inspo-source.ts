import axios from 'axios'
import { signServiceToken } from '@nau/auth'
import { logger, logError } from '@/modules/shared/logger'

export interface BrandDigest {
  content: string
  attachedUrls: string[]
}

export interface SourceConcept {
  id: string
  brandId: string
  content: string
  sourceType: string
  status: string
  createdAt: string
}

const NAUTHENTICITY_TIMEOUT_MS = 30_000

async function makeServiceToken(): Promise<string | null> {
  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) return null
  return signServiceToken({ secret: authSecret, iss: 'flownau', aud: 'nauthenticity' })
}

function baseUrl(): string | null {
  return process.env.NAUTHENTICITY_URL ?? null
}

export async function fetchPendingSourceConcepts(brandId: string): Promise<SourceConcept[]> {
  const base = baseUrl()
  const token = await makeServiceToken()
  if (!base || !token) {
    logger.warn('[InspoSource] NAUTHENTICITY_URL or AUTH_SECRET not configured')
    return []
  }
  try {
    const response = await axios.get<SourceConcept[]>(
      `${base}/api/v1/_service/brands/${encodeURIComponent(brandId)}/source-concepts`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: NAUTHENTICITY_TIMEOUT_MS },
    )
    return response.data ?? []
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED')) {
      logger.warn(`[InspoSource] nauthenticity unreachable (${err.code}) — skipping`)
    } else {
      logError('[InspoSource] Error fetching pending source concepts', err)
    }
    return []
  }
}

export async function generateSourceConcepts(brandId: string): Promise<SourceConcept[]> {
  const base = baseUrl()
  const token = await makeServiceToken()
  if (!base || !token) return []
  try {
    const response = await axios.post<SourceConcept[]>(
      `${base}/api/v1/_service/brands/${encodeURIComponent(brandId)}/source-concepts/generate`,
      {},
      { headers: { Authorization: `Bearer ${token}` }, timeout: 120_000 },
    )
    return response.data ?? []
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
        logger.warn(`[InspoSource] nauthenticity unreachable (${err.code}) — skipping generation`)
      } else {
        logError('[InspoSource] Error generating source concepts', err)
      }
    } else {
      logError('[InspoSource] Unexpected error generating source concepts', err)
    }
    return []
  }
}

export async function markSourceConceptConsumed(conceptId: string): Promise<void> {
  const base = baseUrl()
  const token = await makeServiceToken()
  if (!base || !token) return
  try {
    await axios.patch(
      `${base}/api/v1/_service/source-concepts/${encodeURIComponent(conceptId)}/consume`,
      {},
      { headers: { Authorization: `Bearer ${token}` }, timeout: NAUTHENTICITY_TIMEOUT_MS },
    )
  } catch (err: unknown) {
    logError(`[InspoSource] Failed to mark concept ${conceptId} consumed`, err)
  }
}

// Legacy — kept for digest-only fallback (owned-synthesis mode when InspoBase is empty)
export async function fetchBrandDigest(brandId: string): Promise<BrandDigest | null> {
  const base = baseUrl()
  const token = await makeServiceToken()
  if (!base) {
    logger.warn('[InspoSource] NAUTHENTICITY_URL not configured — skipping brand digest')
    return null
  }
  if (!token) {
    logger.warn('[InspoSource] AUTH_SECRET not configured — cannot call nauthenticity')
    return null
  }
  try {
    const response = await axios.get<BrandDigest>(
      `${base}/api/v1/_service/brands/${encodeURIComponent(brandId)}/inspo/digest`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: NAUTHENTICITY_TIMEOUT_MS },
    )
    const digest = response.data
    if (!digest || typeof digest.content !== 'string') {
      logger.warn(`[InspoSource] Unexpected digest response shape for brand ${brandId}`)
      return null
    }
    if (!digest.content.trim()) {
      logger.info(`[InspoSource] No InspoBase content for brand ${brandId} — using DNA-only mode`)
      return null
    }
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
