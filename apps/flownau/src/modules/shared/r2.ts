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
