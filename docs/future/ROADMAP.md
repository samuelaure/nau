# naŭ Platform — Foundational Refactor Roadmap

> The phased execution plan for the April 2026 foundational refactor.
> Each phase is independently reviewable and mergeable.

---

## Context

Pre-launch. No production traffic. One-time opportunity to set the foundations clean before thousands of tenants depend on them. See [../platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md) for the target state this roadmap builds toward.

---

## Phases

### Phase 0 — Docs skeleton ✅
**Status:** complete (this commit)

Target state on paper before writing code. Every subsequent phase has a north star.

- [x] `docs/README.md`
- [x] `docs/platform/ARCHITECTURE.md`
- [x] `docs/platform/ENTITIES.md`
- [x] `docs/platform/AUTH.md`
- [x] `docs/platform/API-CONTRACT.md`
- [x] `docs/platform/NAMING.md`
- [x] `docs/future/ROADMAP.md` (this file)
- [x] `docs/future/rag-knowledge-base.md`
- [x] 7 ADRs in `docs/decisions/`
- [x] 9 stubs in `docs/services/`
- [x] 4 files in `docs/features/` (content-creation-pipeline, brand-intelligence, comment-suggester, sso)
- [x] 7 stubs in `docs/packages/` (auth, sdk, types, config, logger, ui, storage)
- [x] `.agent/DOCUMENTATION.md` updated to redirect to `docs/`

### Phase 1 — Shared packages (foundation libs)

Create the reusable packages that every service imports. Done before any service refactor so apps adopt them from clean state.

- [ ] `packages/types` — canonical TypeScript types (entities, enums, DTOs)
- [ ] `packages/auth` — JWT/cookie/CSRF/service-token utilities (NestJS guards + Next.js middleware)
- [ ] `packages/config` — zod-based env validation helper
- [ ] `packages/logger` — pino setup with standard fields
- [ ] Unit tests for `@nau/auth` (token flows, CSRF, service tokens)

**Exit criteria:** `pnpm -r build` succeeds; unit tests pass.

### Phase 2 — 9naŭ API refactor

The control plane rebuild. Fresh Prisma schema from the new entity spec, new endpoints following the canonical URL pattern, new auth model.

- [ ] New Prisma schema (`User`, `Session`, `ServiceClient`, `AuthLinkToken`, `Workspace`, `WorkspaceMember`, `Brand`, `SocialProfile`, `Prompt`)
- [ ] Fresh `init` migration (no migration history to preserve — pre-launch)
- [ ] Auth module rebuilt: access (15m) + refresh (30d) rotation, RFC 6749 reuse detection, session revocation
- [ ] `ServiceAuthGuard` replaces the old shared-key pattern
- [ ] `/.well-known/openid-configuration` + `/.well-known/jwks.json` (stub during HS256)
- [ ] All workspace/brand/social-profile/prompt endpoints per [API-CONTRACT.md](../platform/API-CONTRACT.md)
- [ ] Remove all `/service` suffix routes (merged into scope-based guards)
- [ ] Scope-based authorization via `@requireScope()` decorator
- [ ] Integration tests (endpoint × auth-context matrix)

**Exit criteria:** fresh DB + seed; full test suite passes; `@nau/sdk` can call every endpoint (scaffold SDK in parallel).

### Phase 3 — `@nau/sdk`

Typed client consumed by every downstream service.

- [ ] `createNauClient({ mode: 'user' | 'service', ... })`
- [ ] Typed methods for every 9naŭ API endpoint
- [ ] Automatic access-token refresh on 401
- [ ] Request/response logging via `@nau/logger`
- [ ] Retry + circuit-breaker for transient errors
- [ ] Integration tests against local 9naŭ API

**Exit criteria:** import `@nau/sdk` in a scratch Next.js app, call every endpoint successfully.

### Phase 4 — `accounts.9nau.com` SSO hardening

Rebuild login flow on server actions. HttpOnly cookies. No URL tokens. Refresh support.

- [ ] Server-action login POST handler; sets `nau_at` + `nau_rt` via `Set-Cookie`
- [ ] Server-action register
- [ ] Server-action refresh
- [ ] Server-action logout
- [ ] Remove all `document.cookie` writes
- [ ] Remove `?token=` URL param propagation
- [ ] Nauthenticity's old `/auth/callback` proxy route: deleted (no longer needed with shared cookie)
- [ ] Telegram link banner flow updated to use `nau_at` cookie
- [ ] E2E test: login from `accounts.9nau.com` → navigate to `flownau.9nau.com` → authenticated without redirect

**Exit criteria:** E2E auth flow passes across `.9nau.com` subdomains.

### Phase 5 — nauthenticity refactor (Fastify → NestJS)

Framework unification + schema realignment to the new entity model.

- [ ] Scaffold new NestJS app in-place (or side-by-side temporarily)
- [ ] Migrate each Fastify controller to NestJS controller/module
- [ ] Migrate BullMQ workers to `@nestjs/bullmq`
- [ ] Migrate static serving (dashboard) to NestJS
- [ ] New Prisma schema: drop `BrandIntelligence`, `BrandTarget`, `IgProfile`; keep `Post`, `Media`, `Transcript`, `Embedding`, `ScrapingRun`, `InspoItem`, `BrandSynthesis`, `CommentFeedback`
- [ ] Fresh `init` migration
- [ ] Replace all service-key auth with `ServiceAuthGuard` from `@nau/auth`
- [ ] Consume 9naŭ API via `@nau/sdk` for workspace/brand/socialprofile lookups
- [ ] pgvector retained; extend to generic `KnowledgeChunk` pattern per [rag-knowledge-base.md](rag-knowledge-base.md)
- [ ] Remove Fastify dependencies

**Exit criteria:** all scraping + comment + inspo flows work end-to-end; framework consistency with 9naŭ API.

### Phase 6 — flownaŭ refactor

Schema realignment, route rename, SDK consumer, prompt centralization.

- [ ] New Prisma schema:
    - `SocialProfileCredentials` (renamed from and slimmed-down `SocialAccount`)
    - Drop `BrandPersona`, `IdeasFramework`, `ContentCreationPrinciples` (moved to `Prompt` in 9naŭ API)
    - Update all FK references: `accountId` → `socialProfileId`, etc.
- [ ] Fresh `init` migration
- [ ] All API routes moved to `/api/v1/*` canonical paths
- [ ] Replace `fetch(api.9nau.com/...)` calls with `@nau/sdk`
- [ ] Server actions rewritten:
    - `addAccount` → `addSocialProfile`
    - `deleteAccount` → `deleteSocialProfile`
    - `updateAccount` → `updateSocialProfile`
    - `moveAccountToWorkspace` → `moveSocialProfileToBrand` (requires target brand, not workspace directly)
- [ ] `getUserPrimaryWorkspace` → `getUserPrimaryBrand` (convenience for single-brand users)
- [ ] Prompt resolution via `@nau/sdk`:
    - old `BrandPersona` lookups → `sdk.prompts.resolve({ ownerType: 'BRAND', ownerId: brandId, type: 'CONTENT_PERSONA' })`
- [ ] Ideation, composition, render, publish pipelines updated to new schema
- [ ] All routes enforce workspace/brand membership via `@nau/auth` scopes

**Exit criteria:** full 3-ideation-flow matrix (captured/manual/automatic) passes end-to-end.

### Phase 7 — zazu cleanup

Drop NextAuth, use SSO, use SDK.

- [ ] `zazu-dashboard/auth.ts` replaced: consume `nau_at` cookie like every other subdomain
- [ ] Drop the `nau-sso` and `telegram-login` NextAuth providers (replaced by `@nau/auth` + Telegram initData verification endpoint in 9naŭ API)
- [ ] Brand/workspace CRUD uses user JWT via `@nau/sdk` (not service key)
- [ ] Service key only retained for bot-to-api paths (e.g. proactive delivery targeting)
- [ ] Telegram Mini App: `/api/telegram/initdata` endpoint in 9naŭ API handles initData verification → issues user JWT
- [ ] Drop zazu's local `User.nauUserId` mapping — one source of truth is the 9naŭ User.id

**Exit criteria:** login via Telegram Mini App → zazu-dashboard reads `nau_at` → user context is identical to logging in via `accounts.9nau.com`.

### Phase 8 — Monorepo consolidation

Flatten the repo into a single pnpm + turbo workspace.

- [ ] Root `pnpm-workspace.yaml` + `turbo.json`
- [ ] Move apps:
    - `9nau/apps/api` → `apps/9nau-api`
    - `9nau/apps/accounts` → `apps/accounts`
    - `9nau/apps/app` → `apps/app`
    - `9nau/apps/mobile` → `apps/mobile`
    - `flownau` → `apps/flownau`
    - `nauthenticity` → `apps/nauthenticity`
    - `zazu/apps/bot` → `apps/zazu-bot`
    - `zazu/apps/dashboard` → `apps/zazu-dashboard`
    - `whatsnau/packages/backend` → `apps/whatsnau-backend`
    - `whatsnau/packages/frontend` → `apps/whatsnau-frontend`
- [ ] All `packages/*` retained at root
- [ ] Root `tsconfig.base.json`, `.eslintrc`, `.prettierrc` shared
- [ ] `turbo.json` with task dependencies + path-based caching
- [ ] GitHub Actions path filters: only changed apps build/deploy
- [ ] Per-app `Dockerfile` in its app directory
- [ ] Update `docker-compose.yml` with new paths
- [ ] Git history preserved via `git mv` (diffs stay readable)

**Exit criteria:** `pnpm -r build` builds every app; changing one app triggers only that app's CI pipeline.

### Phase 9 — Final docs + ADRs populated

Fill in the docs stubs with real code references now that code exists.

- [ ] Populate `docs/services/*.md` with real API surfaces linking to code
- [ ] Populate `docs/features/*.md` with real file references
- [ ] Populate `docs/packages/*.md` with usage examples
- [ ] Each ADR gets "Consequences observed" section
- [ ] `docs/future/*.md` updated with what moved out of future into the main docs
- [ ] `.agent/DOCUMENTATION.md` replaced with a pointer to `docs/README.md`

**Exit criteria:** new developer reads `docs/README.md`, can navigate to any concept, finds the code for it without asking.

---

## Execution model

- **One branch per phase.** Work in `refactor/phase-N-<slug>` branches.
- **Phase branches merge into `refactor/foundation`** (the integration branch for this whole effort).
- **`refactor/foundation` merges into `main`** only when all phases are complete and validated end-to-end.
- **User reviews at each phase checkpoint.** Claude stops after each phase for approval before starting the next.
- **No partial phases in main.** Every merge is a shippable unit.

---

## Non-goals (explicitly out of scope for this roadmap)

- whatsnaŭ integration into the platform (standalone SaaS, separate concern)
- Mobile app refactor (stays on current architecture; inherits new auth in a future phase)
- RS256 + JWKS migration (documented, not executed — see [rs256-jwks-migration.md](rs256-jwks-migration.md))
- Atomic brand lifecycle with outbox/events (documented, not executed — see [atomic-brand-lifecycle.md](atomic-brand-lifecycle.md))
- Observability stack (metrics, tracing, alerting — see [observability.md](observability.md))
- Brand-level membership (see [brand-collaboration.md](brand-collaboration.md))
- Content origin expansion (YouTube, blogs — see [content-origins-expansion.md](content-origins-expansion.md))
- New social platform publishing beyond Instagram (TikTok, YouTube — see [social-platform-expansion.md](social-platform-expansion.md))

These are documented so they're planned, not lost.

---

## Rollback plan

Because there is no production data, rollback at any phase is:

1. Revert the phase branch.
2. Drop the Postgres volumes (if Prisma schema changed).
3. Re-apply the previous `init` migration.

Once production traffic exists (post-launch), rollback becomes non-trivial and subsequent refactors must be expand-contract (dual-write, backfill, cut-over).

---

## Status tracking

| Phase | Status | Branch | Merged? |
|---|---|---|---|
| 0 | 🟢 complete | `refactor/phase-0-docs` | pending |
| 1 | 🔴 not started | — | — |
| 2 | 🔴 not started | — | — |
| 3 | 🔴 not started | — | — |
| 4 | 🔴 not started | — | — |
| 5 | 🔴 not started | — | — |
| 6 | 🔴 not started | — | — |
| 7 | 🔴 not started | — | — |
| 8 | 🔴 not started | — | — |
| 9 | 🔴 not started | — | — |
