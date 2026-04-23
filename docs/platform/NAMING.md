# naŭ Platform — Naming Canon

> The canonical naming rules for the entire platform. This is the reference a developer reads before asking "what should I call this?"
>
> Rule: if this doc says it, it is the correct name. Everywhere. Forever.

---

## 1. Why a naming canon

naŭ Platform grew from several independent apps. Early inconsistencies (e.g., `SocialAccount` in one app and `IgProfile` for the same concept in another) created unnecessary cognitive load. This doc locks naming for the platform's long life so every new feature, every new developer, and every cross-service integration points at the same vocabulary.

---

## 2. Entity names (canonical)

### 2.1. Identity & tenancy

| Canonical name | Scope | Definition | Do NOT call it |
|---|---|---|---|
| `User` | platform | A human with a `naŭ Account`. | `Account` (reserved for meta domain), `Identity`, `Member` |
| `Workspace` | platform | A collaboration group of users managing a brand fleet. | `Organization`, `Team`, `Tenant` |
| `WorkspaceMember` | platform | Link between `User` and `Workspace` with a role. | `Membership`, `UserWorkspace`, `WorkspaceUser` |
| `Brand` | platform | A brand entity within a workspace (name, voice, strategy, timezone). | `BrandIntelligence`, `Company`, `Project` |
| `SocialProfile` | platform | A social-platform presence (Instagram, TikTok, …). May be OWNED by a brand, or monitored. One entity, many roles. | `SocialAccount`, `IgProfile`, `SocialMediaAccount`, `Profile`, `Channel` |
| `Prompt` | platform | Any LLM prompt text used by any service. Centralized. | `SystemPrompt`, `BrandPersona`, `IdeasFramework`, `ContentCreationPrinciples` |
| `Session` | platform | A user's active authentication session. | `RefreshSession`, `UserSession` |
| `ServiceClient` | platform | A service registered to call the 9naŭ API. | `ApiKey`, `ServiceAccount` |

### 2.2. flownaŭ domain (content creation)

| Canonical name | Definition |
|---|---|
| `SocialProfileCredentials` | OAuth tokens for an OWNED `SocialProfile` (flownaŭ-only, isolated for security). |
| `Asset` | Uploaded media (image, video, audio). Scoped to a `SocialProfile`. |
| `Template` | Remotion video template. Scoped to a `SocialProfile`. |
| `AccountTemplateConfig` | Enabled templates + auto-approve settings per `SocialProfile`. (Name kept from legacy — historical carveout, see ADR-007.) |
| `Composition` | A planned/executed post (idea + template + slots + payload). |
| `RenderJob` | Async rendering state for a `Composition`. |
| `ContentIdea` | A raw content idea before composition. |
| `ContentPlan` | Daily bundle of pieces + scripts per `SocialProfile`. |
| `ContentPlanner` | Per-brand planning config (strategistPrompt, cadence, postingTimes). |

### 2.3. nauthenticity domain (brand intelligence)

| Canonical name | Definition |
|---|---|
| `Post` | A scraped social media post (Instagram, TikTok, …). Keyed by `(platform, platformId)` for dedup. |
| `Media` | Image/video attached to a `Post`. |
| `Transcript` | Audio→text transcription from a `Media`. |
| `Embedding` | pgvector embedding of a `Transcript` (or generic chunk in future). |
| `ScrapingRun` | Apify job tracking. |
| `InspoItem` | User-captured inspiration source. Scoped to a `Brand`. |
| `BrandSynthesis` | AI-generated synthesis of a brand's content patterns. |
| `CommentFeedback` | User selection feedback on suggested comments. |

### 2.4. zazu domain

| Canonical name | Definition |
|---|---|
| `TelegramUser` | Link between `naŭ User.id` and `telegramId`. |
| `ConversationState` | Per-user conversational context for the bot. |

### 2.5. Forbidden names (never use)

- `SocialAccount` → use `SocialProfile`
- `IgProfile` → use `SocialProfile`
- `BrandIntelligence` → use `Brand` (all brand fields are consolidated there)
- `BrandTarget` → use `SocialProfile` (role = `COMMENT_TARGET` or `BENCHMARK_TARGET`)
- `BrandPersona` → use `Prompt` (type = `CONTENT_PERSONA`)
- `IdeasFramework` (as a table) → use `Prompt` (type = `IDEAS_FRAMEWORK`)
- `ContentCreationPrinciples` (as a table) → use `Prompt` (type = `CONTENT_PRINCIPLES`)
- `platformWorkspaceId` → use `workspaceId` (it's always a 9naŭ workspace id)
- `nauBrandId` → use `brandId`
- `nauUserId` → use `userId`

---

## 3. Field names

### 3.1. Foreign keys

Every foreign key to a 9naŭ entity uses the bare, unprefixed name + `Id`:

- `userId` — refs `User.id` in 9naŭ API
- `workspaceId` — refs `Workspace.id` in 9naŭ API
- `brandId` — refs `Brand.id` in 9naŭ API
- `socialProfileId` — refs `SocialProfile.id` in 9naŭ API

No `nau` prefix. No `platform` prefix. No `main` prefix (use `mainSocialProfileId` only when there's ambiguity with the parent link).

### 3.2. Timestamps

- `createdAt` — row creation (every table has it)
- `updatedAt` — row last modified (every mutable table has it, with `@updatedAt`)
- `deletedAt` — soft-delete marker (nullable; only used on tables that opt-in to soft-delete)
- `expiresAt` — for time-limited entities (tokens, sessions)
- `revokedAt` — for revocable entities (sessions, credentials)
- `*At` for events (e.g. `postedAt`, `publishedAt`, `scheduledAt`, `linkedAt`)

### 3.3. Booleans

- Prefix with `is` or `has`: `isActive`, `isDefault`, `isPaused`, `hasTranscript`
- Never `disabled`, `inactive`, `pause` (non-boolean words)

### 3.4. Enums

Enums use UPPER_SNAKE_CASE values and match one of these naming patterns:

- Role enums: singular noun (`WorkspaceRole` with `OWNER`, `ADMIN`, `MEMBER`)
- State enums: adjective (`ContentIdeaStatus` with `PENDING`, `APPROVED`, `REJECTED`)
- Type enums: noun (`PromptType` with `VOICE`, `COMMENT_STRATEGY`, ...)

---

## 4. API URL patterns

### 4.1. Domain conventions

| Subdomain | Purpose | URL root convention |
|---|---|---|
| `api.9nau.com` | 9naŭ API — pure API, no UI | routes at **root** (`/auth/login`, `/workspaces`) |
| `accounts.9nau.com` | SSO UI + minimal auth API | UI at `/`, auth helpers at `/api/auth/*` |
| `app.9nau.com` | Second Brain UI | UI at `/`, API at `/api/...` |
| `flownau.9nau.com` | Content engine UI + API | UI at `/`, API at `/api/v1/...` |
| `nauthenticity.9nau.com` | Brand intelligence UI + API | UI at `/`, API at `/api/v1/...` |
| `zazu.9nau.com` | Telegram Mini App UI + API | UI at `/`, API at `/api/...` |

**Why 9naŭ API drops the `/api` prefix:** it's a pure API service (no UI served from the same origin), so the prefix is redundant. Other services serve UI + API from the same origin and need `/api/v1/` to disambiguate from Next.js page routes.

**Why `/api/v1/` (with explicit version) on content services:** these services have longer-lived external consumers (mobile apps, future partner integrations). Versioning the API path allows breaking changes to v2 without disrupting v1 clients.

### 4.2. Path style

- **kebab-case** for resources: `/social-profiles`, `/content-ideas`, `/brand-synthesis`
- **camelCase** for query params: `?workspaceId=X&isActive=true`
- **Nested resources** when ownership is meaningful: `/workspaces/:id/brands/:brandId/social-profiles`
- **Flat accessors** allowed when cross-workspace lookup is common: `GET /brands/:id` returns a brand directly if the caller is authorized.

### 4.3. Resource endpoint canon

```
GET    /<collection>                    — list
POST   /<collection>                    — create
GET    /<collection>/:id                — read
PATCH  /<collection>/:id                — partial update
PUT    /<collection>/:id                — replace (rare; prefer PATCH)
DELETE /<collection>/:id                — delete
POST   /<collection>/:id/<action>       — action on a resource (e.g. /approve, /publish)
```

No `/v1/accounts/:id/update` or `/v1/brands/delete/:id` — always REST-canonical.

### 4.4. Action endpoints

Use imperative verbs in the last path segment:

- `POST /compositions/:id/approve-post`
- `POST /compositions/:id/mark-posted`
- `POST /brands/:id/comment-suggestions`
- `POST /ingest/ideas` (service-auth)

### 4.5. Forbidden URL patterns

- `/api/v1/accounts` for social profiles → use `/api/v1/social-profiles`
- `/api/workspace-accounts?workspaceId=X` → use `/api/v1/workspaces/:id/social-profiles`
- `?token=...` in redirect URLs → forbidden (security)
- Trailing slashes in routes → forbidden (redirect or 404)

---

## 5. HTTP headers

| Header | Purpose | Value |
|---|---|---|
| `Authorization: Bearer <token>` | User JWT or service JWT | the JWT |
| `x-nau-csrf` | CSRF token (double-submit pattern) | value that matches `nau_csrf` cookie |
| `x-nau-client-version` | client SDK version (optional, for telemetry) | e.g. `@nau/sdk@1.2.3` |
| `x-nau-request-id` | request correlation ID | UUID; if client sends it, server echoes; else server generates |

### 5.1. Deprecated headers (do not use)

- `x-nau-service-key` — replaced by signed service JWTs in `Authorization: Bearer`
- `x-service-key` — never the canonical name; remove any code using this

### 5.2. Cookie names

| Cookie | Purpose | Flags |
|---|---|---|
| `nau_at` | Access token (JWT, 15m) | `HttpOnly; Secure; SameSite=Lax; Domain=.9nau.com; Path=/` |
| `nau_rt` | Refresh token (opaque, 30d) | `HttpOnly; Secure; SameSite=Strict; Domain=.9nau.com; Path=/auth/refresh` |
| `nau_csrf` | CSRF double-submit token (1h) | `Secure; SameSite=Strict; Domain=.9nau.com` (NOT HttpOnly — client reads it) |

### 5.3. Deprecated cookie names

- `nau_token` — replaced by `nau_at` + `nau_rt`

---

## 6. Environment variables

### 6.1. Conventions

- UPPER_SNAKE_CASE
- Platform-wide variables: `NAU_` prefix (`NAU_SERVICE_KEY` — now deprecated, but pattern illustrated)
- Service-specific variables: service name prefix (`FLOWNAU_SERVICE_SECRET`, `NAUTHENTICITY_SERVICE_SECRET`)
- Third-party service credentials: the third-party's name prefix (`OPENAI_API_KEY`, `APIFY_TOKEN`, `R2_ACCESS_KEY`)

### 6.2. Canon

| Variable | Where | Purpose |
|---|---|---|
| `AUTH_SECRET` | all | HS256 JWT signing secret (shared during Phase 2; moves to asymmetric later) |
| `DATABASE_URL` | per service | PostgreSQL connection string |
| `REDIS_URL` | per service | Redis connection |
| `CRON_SECRET` | flownaŭ | Cron auth secret |
| `<SERVICE>_SERVICE_SECRET` | that service | Service's own client secret for signing outgoing service JWTs |
| `SERVICE_SECRET_<ISS>` | 9naŭ API | Secret for verifying incoming service JWT from `iss=<ISS>` |
| `OPENAI_API_KEY` | services that use OpenAI | |
| `GROQ_API_KEY` | services that use Groq | |
| `APIFY_TOKEN` | nauthenticity | |
| `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET_NAME` | services that use R2 | |
| `NEXT_PUBLIC_*` | web apps | Client-exposed env vars |

---

## 7. File and folder names

### 7.1. Apps and packages

- Apps: kebab-case directory names (`9nau-api`, `zazu-bot`, `zazu-dashboard`). After monorepo consolidation (Phase 8), all under `apps/`.
- Packages: kebab-case under `packages/`. npm names: `@nau/sdk`, `@nau/auth`, `@nau/types`, `@nau/config`, `@nau/logger`, `@nau/ui`, `@nau/storage`.

### 7.2. Source files

- Controllers / routes: `<resource>.controller.ts` (NestJS), `route.ts` (Next.js App Router).
- Services: `<domain>.service.ts` (NestJS) or `<domain>.ts` (general).
- Schemas: `<domain>.schema.ts` (zod validation).
- Types: `<domain>.types.ts` (only for types that can't live in `@nau/types`).
- Tests: `<name>.spec.ts` or `<name>.test.ts` (one convention per app — prefer `.spec.ts`).

### 7.3. React components

- PascalCase filename matching export: `BrandSelector.tsx` exports `BrandSelector`.
- One component per file (exceptions only for tightly coupled private subcomponents).

---

## 8. Log message conventions

- Structured logs only (via `@nau/logger`, pino). No `console.log` in production code.
- Log levels: `trace | debug | info | warn | error | fatal`.
- Required fields: `requestId`, `userId?`, `service`, `operation`.
- Never log: raw tokens, passwords, OAuth secrets, Prompt.content, scraped post content.

---

## 9. Summary of renames (from legacy code)

This table documents every concept that had a different name in the pre-refactor codebase. During Phases 2–6, code is updated to match the left column.

| Concept | Old name | New canonical name |
|---|---|---|
| Brand's own publishing profile | `SocialAccount` (flownaŭ) | `SocialProfile` with `role=OWNED` |
| Monitored competitor profile | `IgProfile` + `BrandTarget` (nauthenticity) | `SocialProfile` with `role=COMMENT_TARGET` or `BENCHMARK_TARGET` |
| Brand's AI intelligence | `BrandIntelligence` (nauthenticity) | merged into `Brand` (9naŭ); variants go to `Prompt` |
| Content persona | `BrandPersona` | `Prompt { type: CONTENT_PERSONA }` |
| Ideas framework | `IdeasFramework` | `Prompt { type: IDEAS_FRAMEWORK }` |
| Content principles | `ContentCreationPrinciples` | `Prompt { type: CONTENT_PRINCIPLES }` |
| Strategist prompt | `ContentPlanner.strategistPrompt` | `Prompt { type: STRATEGIST }` |
| Director prompt | `SocialAccount.directorPrompt` | `Prompt { type: DIRECTOR, ownerType: SOCIAL_PROFILE }` |
| Creation prompt | `SocialAccount.creationPrompt` / `Template.creationPrompt` | `Prompt { type: CREATION }` |
| Caption prompt | `Template.captionPrompt` | `Prompt { type: CAPTION }` |
| Voice prompt | `BrandIntelligence.voicePrompt` | `Brand.voicePrompt` (primary) + `Prompt { type: VOICE }` (variants) |
| Access token cookie | `nau_token` | `nau_at` |
| Refresh token cookie | (did not exist) | `nau_rt` |
| Service auth header | `x-nau-service-key` (shared secret) | `Authorization: Bearer <service-jwt>` (per-service) |

---

## 10. Related docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — overall architecture
- [ENTITIES.md](ENTITIES.md) — full schemas
- [AUTH.md](AUTH.md) — auth details
- [API-CONTRACT.md](API-CONTRACT.md) — full endpoint list
- [../decisions/ADR-007-naming-canon.md](../decisions/ADR-007-naming-canon.md) — rationale for these choices
