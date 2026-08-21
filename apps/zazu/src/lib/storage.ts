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

let _privateStorage: NauStorage | null = null

/**
 * Storage for anything personal — voice notes above all.
 *
 * A separate bucket, not a separate prefix. `nau-storage` has media.9nau.com
 * bound to it as a custom domain, which publishes the entire bucket: every
 * voice note written there was downloadable by anyone with the path, and the
 * path contains the Telegram id rather than being fully random. A prefix cannot
 * fix that; only a bucket with no domain attached can.
 *
 * No envPrefix: this bucket serves one purpose, so environment separation would
 * add a directory level without adding meaning.
 */
export function getPrivateStorage(): NauStorage {
  if (_privateStorage) return _privateStorage
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PRIVATE_BUCKET_NAME } = process.env
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PRIVATE_BUCKET_NAME) {
    throw new Error('Private R2 storage not configured — missing R2_PRIVATE_BUCKET_NAME')
  }
  _privateStorage = createStorage({
    endpoint: R2_ENDPOINT,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_PRIVATE_BUCKET_NAME,
    publicUrl: '',
    envPrefix: '',
  })
  return _privateStorage
}
