import axios from 'axios'
import { signServiceToken } from '@nau/auth'
import { logger, logError } from '@/modules/shared/logger'

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

