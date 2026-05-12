import { createStorage, NauStorage } from 'nau-storage'

let _storage: NauStorage | null = null

export function getStorage(): NauStorage {
  if (_storage) return _storage
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL, NODE_ENV } = process.env
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error('R2 storage not configured — missing R2_* env vars')
  }
  _storage = createStorage({
    endpoint: R2_ENDPOINT,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET_NAME,
    publicUrl: R2_PUBLIC_URL,
    envPrefix: NODE_ENV ?? 'development',
  })
  return _storage
}
