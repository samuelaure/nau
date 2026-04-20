/**
 * In-memory brand context cache (TTL = 5 minutes).
 * Prevents aggressive re-prompting when a user operates within a continuous
 * conversation flow after having already selected a brand.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  brandId: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedBrand(nauUserId: string): string | null {
  const entry = cache.get(nauUserId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(nauUserId);
    return null;
  }
  return entry.brandId;
}

export function setCachedBrand(nauUserId: string, brandId: string): void {
  cache.set(nauUserId, { brandId, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearCachedBrand(nauUserId: string): void {
  cache.delete(nauUserId);
}
