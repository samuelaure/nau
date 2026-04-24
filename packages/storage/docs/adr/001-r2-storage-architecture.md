# ADR 001 — Cloudflare R2 Storage Architecture

## Status

Accepted — 2026-04-22

## Context

As the naŭ Platform grew, each app (flownau, nauthenticity, 9nau) independently wired up its own Cloudflare R2 client using `@aws-sdk/client-s3`. This led to:

- Duplicated S3 client initialization across three codebases
- Divergent file key schemas with no top-level namespace (e.g., `raw/`, `content/`, `users/`, `{projectFolder}/`, and `{username}/` all coexisting at the bucket root)
- Missing delete operations in some apps (objects leaked in R2 when DB records were removed)
- Inconsistent upload strategies (server-relay in flownau, presigned URLs in 9nau)
- Profile images accumulating stale versions due to timestamp-based keys with no cleanup
- All apps sharing the same R2 credentials with no scope isolation

The single `nau-storage` bucket with CDN domain `media.9nau.com` is correct and stays. What needed standardization was everything *above* the bucket API.

## Decision

### 1. Centralized `@nau/storage` package

All storage operations go through `packages/storage` — a shared TypeScript package at the platform root. No app constructs an S3Client or builds a storage key manually. The package owns:

- S3Client initialization (`src/client.ts`)
- All CRUD + presign operations (`NauStorage` class)
- Zod-based env validation (`src/env.ts`)
- Canonical key builders per app (`src/paths.ts`)
- TypeScript types (`src/types.ts`)

Apps reference it with `"@nau/storage": "file:../../packages/storage"` in their `package.json`. The package points `"main"` at `./src/index.ts` so consuming apps' TypeScript compilers resolve source directly, avoiding a build step.

### 2. App-namespaced bucket key schema

Every key starts with the app name. This makes lifecycle rules, access logs, and future per-app credential scoping unambiguous.

```
nau-storage/
├── flownau/
│   ├── accounts/{accountId}/assets/{videos|audios|images}/{assetId}.{ext}
│   ├── accounts/{accountId}/assets/thumbnails/{assetId}.jpg
│   ├── accounts/{accountId}/outputs/{renderId}.mp4
│   ├── accounts/{accountId}/outputs/{renderId}_thumb.jpg
│   ├── templates/{templateId}/assets/{assetId}.{ext}
│   └── profiles/{userId}/avatar.{ext}
│
├── nauthenticity/
│   ├── raw/{username}/posts/{mediaId}.{ext}        ← temporary; 7-day lifecycle rule
│   └── content/{username}/posts/{mediaId}.{ext}
│   └── content/{username}/profile.{ext}
│
└── 9nau/
    ├── users/{userId}/captures/{blockId}.{ext}
    └── users/{userId}/avatar.{ext}
```

**Key design rules:**
- Entity IDs (accountId, userId) in paths, not mutable handles (usernames). Usernames in `nauthenticity` are an exception because the Instagram username *is* the entity identity there.
- Profile avatars use a fixed path (`avatar.{ext}`) and overwrite in place. No timestamp suffixes. Old versions are eliminated by the write.
- The `raw/` prefix is explicitly temporary. The optimization worker deletes raw objects after producing the `content/` version. A 7-day R2 lifecycle rule on `nauthenticity/raw/` acts as a safety net if the worker fails.

### 3. Upload strategy

| Scenario | Strategy | Rationale |
|---|---|---|
| User uploads from browser or mobile | Pre-signed `PUT` URL (`presignUpload`) | Client bears bandwidth; server only issues the URL |
| Internal workers (scrapers, renderers, migration scripts) | Server-side `upload()` | Server is the data source; no user involved |
| Public reads | CDN URL via `cdnUrl()` | No credentials needed |
| Access-controlled reads | Pre-signed `GET` URL (future) | Not yet needed |

### 4. R2 lifecycle rules (Cloudflare dashboard)

| Prefix | Rule |
|---|---|
| `nauthenticity/raw/` | Delete after 7 days |

Additional rules can be added per prefix as storage patterns evolve.

### 5. Soft-delete pattern (future work)

When a DB record is deleted, the R2 object should be deleted asynchronously via a background job, not inline. This decouples DB and R2 deletion, prevents objects leaking on job failure, and gives an audit trail. A `storage_deletions` queue (BullMQ) is the recommended implementation.

### 6. Credential scoping (future work)

Currently all apps share one R2 token. Cloudflare R2 supports prefix-scoped API tokens. The target state is one write-capable token per app, scoped to its prefix, with a separate read-only token for services that only serve CDN URLs.

## Consequences

**Positive:**
- One place to rotate R2 credentials
- Impossible to construct an out-of-schema key from app code
- Lifecycle rules and access policies can target clean prefixes
- Upload strategy is explicit and consistent across apps

**Negative (trade-offs):**
- Existing bucket keys (pre-migration) follow the old schema. A one-time migration script must rename objects. CDN URLs will change for all existing content (cache invalidation required).
- The package is a `file:` dependency, not a published npm package. If a new app is added to the platform outside this directory tree, it cannot use the package without copying or publishing it.

## Implementation Rules

- **Never** construct a storage key with string concatenation in app code. Always use a path builder from `@nau/storage`'s `paths` module.
- **Never** instantiate `S3Client` directly in app code. Use `createStorage(loadStorageConfig())` or pass a `StorageConfig` from the framework's DI container.
- **Always** delete the raw object in `nauthenticity` after the optimized object is successfully uploaded. Do not rely solely on the lifecycle rule.
- **Always** use `presignUpload()` for user-initiated uploads from the browser or mobile app. Server-relay (`upload()`) is only correct for server-originated data.
- When adding a new app or entity type to the platform, add its path builders to `packages/storage/src/paths.ts` before writing any upload code.
