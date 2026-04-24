import { createStorage, loadStorageConfig } from 'nau-storage'

export const storage = createStorage(loadStorageConfig())
