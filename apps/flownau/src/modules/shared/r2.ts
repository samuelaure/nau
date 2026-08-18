import { createStorage, loadStorageConfig, NauStorage } from 'nau-storage'

let _storage: NauStorage | null = null

export const storage = new Proxy({} as NauStorage, {
  get(_target, prop) {
    if (!_storage) {
      _storage = createStorage(loadStorageConfig())
    }
    return (_storage as unknown as Record<string | symbol, unknown>)[prop]
  },
})

/**
 * Delegates to the storage client, which strips both the public URL and the
 * environment prefix.
 *
 * This used to strip only the public URL, so it returned keys that still carried
 * the `production/` prefix. Every caller then passed that back into the client,
 * which prefixes again — producing `production/production/...`. Two things broke
 * quietly for months as a result:
 *
 *   - post-publish compression wrote the compressed video to the doubled path
 *     instead of replacing the original, so it never reclaimed any space and
 *     left a second copy behind;
 *   - post and composition deletion targeted the doubled path, so files derived
 *     from a stored URL were never actually removed.
 */
export function keyFromCdnUrl(url: string): string | null {
  return storage.keyFromCdnUrl(url)
}
