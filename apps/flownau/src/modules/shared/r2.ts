import { createStorage, loadStorageConfig, NauStorage } from 'nau-storage'

let _storage: NauStorage | null = null
let _publicUrl: string | null = null

export const storage = new Proxy({} as NauStorage, {
  get(_target, prop) {
    if (!_storage) {
      const config = loadStorageConfig()
      _publicUrl = config.publicUrl
      _storage = createStorage(config)
    }
    return (_storage as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export function keyFromCdnUrl(url: string): string | null {
  if (!_publicUrl) {
    const config = loadStorageConfig()
    _publicUrl = config.publicUrl
    if (!_storage) _storage = createStorage(config)
  }
  const base = _publicUrl.endsWith('/') ? _publicUrl : _publicUrl + '/'
  return url.startsWith(base) ? url.slice(base.length) : null
}
