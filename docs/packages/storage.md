# Package — @nau/storage

- **Location:** `packages/storage`
- **Consumers:** flownaŭ, nauthenticity, 9naŭ app, mobile

---

## Purpose

Typed wrapper over Cloudflare R2 (S3-compatible). Centralizes bucket name, key conventions, and presigned URL generation. No service constructs R2 paths by hand.

---

## Key conventions

```
users/{userId}/avatars/{filename}
brands/{brandId}/assets/{filename}
brands/{brandId}/renders/{renderJobId}/{filename}
brands/{brandId}/inspo/{inspoItemId}/{filename}
```

---

## API

```ts
import { createStorageClient } from '@nau/storage';

const storage = createStorageClient({
  accessKey: process.env.R2_ACCESS_KEY,
  secretKey: process.env.R2_SECRET_KEY,
  bucket: process.env.R2_BUCKET_NAME,
  endpoint: process.env.R2_ENDPOINT,
});

// Upload
await storage.put('brands/abc/assets/hero.jpg', buffer, { contentType: 'image/jpeg' });

// Presigned download URL (1h TTL)
const url = await storage.presign('brands/abc/assets/hero.jpg', { expiresIn: 3600 });

// Delete
await storage.delete('brands/abc/assets/hero.jpg');
```

---

## Status

🔴 Not yet created. Placeholder for Phase 8 (monorepo consolidation). Currently each service uses raw `@aws-sdk/client-s3`.

---

## Related

- [../platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md) — §7 Deployment topology
