# Package — @nau/types

- **Location:** `packages/types`
- **Consumers:** All packages and apps

---

## Purpose

Single source of truth for shared TypeScript types. No type is duplicated across services. Prisma-generated types stay inside their owning service — `@nau/types` contains the canonical DTOs and enums that cross service boundaries.

---

## Contents

### Enums

```ts
export enum WorkspaceRole { OWNER = 'OWNER', ADMIN = 'ADMIN', MEMBER = 'MEMBER' }
export enum SocialPlatform { INSTAGRAM = 'INSTAGRAM', TIKTOK = 'TIKTOK', YOUTUBE = 'YOUTUBE', TWITTER = 'TWITTER' }
export enum SocialProfileRole { OWNED = 'OWNED', COMMENT_TARGET = 'COMMENT_TARGET', BENCHMARK_TARGET = 'BENCHMARK_TARGET', INSPIRATION = 'INSPIRATION' }
export enum PromptOwnerType { WORKSPACE = 'WORKSPACE', BRAND = 'BRAND', USER = 'USER' }
export enum PromptType { VOICE = 'VOICE', IDEAS_FRAMEWORK = 'IDEAS_FRAMEWORK', CONTENT_PERSONA = 'CONTENT_PERSONA', COMPOSITOR = 'COMPOSITOR', CAPTION = 'CAPTION', COMMENT_STRATEGY = 'COMMENT_STRATEGY', BENCHMARK_CHAT = 'BENCHMARK_CHAT' }
```

### Entity DTOs (read-side, no DB internals)

```ts
export interface User { id: string; email: string; name: string; telegramId?: string; createdAt: string; }
export interface Workspace { id: string; name: string; slug: string; timezone: string; createdAt: string; }
export interface Brand { id: string; workspaceId: string; name: string; handle: string; createdAt: string; }
export interface SocialProfile { id: string; brandId: string; platform: SocialPlatform; platformId: string; handle: string; role: SocialProfileRole; createdAt: string; }
export interface Prompt { id: string; ownerType: PromptOwnerType; ownerId: string; type: PromptType; body: string; updatedAt: string; }
```

### Request/response DTOs

Prefixed `Create*`, `Update*`, `*Response` — generated to match API contract exactly.

---

## What it does NOT contain

- Prisma `@prisma/client` types (those stay per-service).
- UI component prop types (those stay in each app).
- Internal service types (queue payloads, worker state, etc.).

---

## Related

- [sdk.md](sdk.md)
- [../platform/ENTITIES.md](../platform/ENTITIES.md)
