# @nau/storage

Centralized Cloudflare R2 storage client for the naŭ Platform.

All naŭ apps (flownau, nauthenticity, 9nau) use this package for every storage operation. No app constructs an S3Client or builds a bucket key directly.

## Docs

- [Integration guide](./docs/storage-guide.md) — how to install and use this package in each app
- [ADR 001](./docs/adr/001-r2-storage-architecture.md) — architectural decisions and rationale

## Quick start

```bash
npm install @nau/storage
```

```typescript
import { createStorage, loadStorageConfig, flownau } from '@nau/storage';

const storage = createStorage(loadStorageConfig());

// Server-side upload
const key = flownau.renderOutput(accountId, renderId);
const cdnUrl = await storage.upload(key, readStream, { mimeType: 'video/mp4' });

// Pre-signed upload (client uploads directly)
const { uploadUrl, cdnUrl } = await storage.presignUpload(key, 'video/mp4');
```

## Required env vars

```
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=nau-storage
R2_PUBLIC_URL=https://media.9nau.com
```
