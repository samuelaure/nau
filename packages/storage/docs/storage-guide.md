# naŭ Platform — Storage Integration Guide

> For the architectural rationale behind these decisions, see [docs/adr/001-r2-storage-architecture.md](./adr/001-r2-storage-architecture.md).

All storage operations on the naŭ Platform go through the `@nau/storage` package. No app constructs an S3Client or builds a bucket key directly.

---

## Installation

Add the package to your app's `package.json`:

```json
{
  "dependencies": {
    "@nau/storage": "file:../../packages/storage"
  }
}
```

Then install:

```bash
# npm
npm install

# pnpm
pnpm install
```

---

## Required environment variables

All apps using storage must set these variables:

```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=nau-storage
R2_PUBLIC_URL=https://media.9nau.com
```

---

## Initializing the client

### Standard (Node.js / Next.js / Express)

```typescript
import { createStorage, loadStorageConfig } from '@nau/storage';

// Call once at startup. Exits the process if any env var is missing.
const storage = createStorage(loadStorageConfig());
```

### NestJS (DI-compatible)

Wrap the client in a provider so it participates in ConfigService:

```typescript
// storage.provider.ts
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createStorage, NauStorage } from '@nau/storage';

export const STORAGE = Symbol('STORAGE');

export const StorageProvider: Provider = {
  provide: STORAGE,
  inject: [ConfigService],
  useFactory: (config: ConfigService): NauStorage =>
    createStorage({
      endpoint: config.getOrThrow('R2_ENDPOINT'),
      accessKeyId: config.getOrThrow('R2_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow('R2_SECRET_ACCESS_KEY'),
      bucket: config.getOrThrow('R2_BUCKET_NAME'),
      publicUrl: config.getOrThrow('R2_PUBLIC_URL'),
    }),
};
```

---

## Uploading files

### From a server-side worker or job (scraper, renderer, migration)

Use `storage.upload()` when the server itself holds the data:

```typescript
import { flownau } from '@nau/storage';

const key = flownau.renderOutput(accountId, renderId);
const cdnUrl = await storage.upload(key, videoBuffer, { mimeType: 'video/mp4' });
```

### From a browser or mobile app

Issue a pre-signed URL from the server; let the client upload directly:

```typescript
// Server (API route / controller)
import { nau, extFromMime } from '@nau/storage';

const ext = extFromMime(mimeType);
const key = nau.userCapture(userId, blockId, ext);
const { uploadUrl, cdnUrl } = await storage.presignUpload(key, mimeType);

return { uploadUrl, cdnUrl }; // return to client
```

```typescript
// Client (browser / React Native)
await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': mimeType } });
// File is now at cdnUrl
```

---

## Deleting files

```typescript
// Single
await storage.delete(key);

// Batch (up to 1000 per call)
await storage.deleteMany([key1, key2, key3]);
```

Always delete the R2 object when its DB record is removed. For user-facing deletes, enqueue a background job rather than deleting inline to avoid blocking the request.

---

## Listing objects

```typescript
import { flownau } from '@nau/storage';

// Folder-like view (objects + sub-prefixes)
const { objects, prefixes } = await storage.list(
  `flownau/accounts/${accountId}/assets/`,
  { delimiter: '/' },
);

// Flat recursive listing (use sparingly — paginate for large prefixes)
const all = await storage.listAll(`flownau/accounts/${accountId}/`);
```

---

## Building CDN URLs

```typescript
const url = storage.cdnUrl(key); // https://media.9nau.com/{key}
```

Never construct CDN URLs with string concatenation. Use `cdnUrl()` so the base URL comes from config.

---

## Path builders

All canonical paths are in `src/paths.ts`. Use the correct namespace for your app:

### flownau

```typescript
import { flownau } from '@nau/storage';

flownau.accountAsset(accountId, 'videos', assetId, 'mp4')
flownau.accountThumbnail(accountId, assetId)
flownau.renderOutput(accountId, renderId)
flownau.renderThumbnail(accountId, renderId)
flownau.templateAsset(templateId, assetId, 'jpg')
flownau.profileAvatar(userId, 'jpg')
```

### nauthenticity

```typescript
import { nauthenticity } from '@nau/storage';

nauthenticity.rawPost(username, mediaId, 'mp4')   // temporary — delete after optimizing
nauthenticity.post(username, mediaId, 'mp4')       // permanent optimized content
nauthenticity.profilePic(username, 'jpg')
```

### 9nau

```typescript
import { nau } from '@nau/storage';

nau.userCapture(userId, blockId, 'mp4')
nau.userAvatar(userId, 'jpg')
```

---

## Adding a new entity type or app

1. Add path builders to `packages/storage/src/paths.ts` under the appropriate app namespace (or a new namespace if it's a new app).
2. Update `packages/storage/src/index.ts` if you added a new export.
3. Update this guide and the ADR with the new paths.
4. Never add storage paths directly in app code.

---

## R2 lifecycle rules

The following lifecycle rules are set in the Cloudflare R2 dashboard and must not be removed:

| Prefix | Rule |
|---|---|
| `nauthenticity/raw/` | Delete after 7 days |

These rules act as a safety net. Worker code must still explicitly delete raw objects after optimization — do not rely on the lifecycle rule as the primary cleanup mechanism.

---

## Bucket key schema (reference)

```
nau-storage/
├── flownau/
│   ├── accounts/{accountId}/assets/videos/{assetId}.mp4
│   ├── accounts/{accountId}/assets/audios/{assetId}.m4a
│   ├── accounts/{accountId}/assets/images/{assetId}.jpg
│   ├── accounts/{accountId}/assets/thumbnails/{assetId}.jpg
│   ├── accounts/{accountId}/outputs/{renderId}.mp4
│   ├── accounts/{accountId}/outputs/{renderId}_thumb.jpg
│   ├── templates/{templateId}/assets/{assetId}.{ext}
│   └── profiles/{userId}/avatar.{ext}
│
├── nauthenticity/
│   ├── raw/{username}/posts/{mediaId}.{ext}
│   ├── content/{username}/posts/{mediaId}.{ext}
│   └── content/{username}/profile.{ext}
│
└── 9nau/
    ├── users/{userId}/captures/{blockId}.{ext}
    └── users/{userId}/avatar.{ext}
```
