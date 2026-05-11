# nauthenticity: Fastify to NestJS consolidation plan

## Why this dual architecture exists

nauthenticity was originally a standalone Fastify service. The entry point `src/app.ts` bootstraps a Fastify instance, registers routes as Fastify plugins (`FastifyPluginAsync`), and starts BullMQ workers. As the platform grew, NestJS was introduced incrementally — `src/main.ts` bootstraps a NestJS app from `src/nest/app.module.ts`.

The **production entry point is `src/main.ts` (NestJS only)**. `package.json` sets `"main": "dist/main.js"` and `"start": "node dist/main"`. The Fastify app (`src/app.ts`) is **not started in production** — it is dead code today. Both layers were live simultaneously at some point during the migration, but the switchover to NestJS-only has already happened at the process level.

This means the migration is further along than it may appear: the Fastify layer is code that still compiles and ships in the image, and some of its modules contain logic that predates the NestJS equivalents, but none of it runs in production.

---

## Current state: route inventory

### Routes that exist only in Fastify (`src/app.ts` / `src/modules/`)

The Fastify layer runs only if `app.ts` is executed directly. In the current production configuration it is not. However, the following routes have Fastify implementations that are either absent or structurally different from their NestJS counterparts:

| Fastify file | Route(s) | Status in NestJS |
|---|---|---|
| `modules/auth/auth.controller.ts` | `GET /auth/callback`, `GET /auth/me`, `GET /auth/logout` | Fully replaced by `nest/auth/auth-callback.controller.ts` |
| `modules/analytics/analytics.controller.ts` | `GET /api/queue`, `POST /api/queue/retry-failed`, `POST /api/queue/clear-failed`, `POST /api/queue/delete-job` | Fully replaced by `nest/analytics/analytics.controller.ts` |
| `modules/ingestion/ingestion.controller.ts` | `POST /api/ingest`, `POST /api/abort`, `POST /api/pause`, `POST /api/resume`, `GET /api/ingest/status/:jobId` | Fully replaced by `nest/ingestion/ingestion.controller.ts` |
| `modules/content/content.controller.ts` | `GET /api/accounts`, `GET /api/accounts/:username`, `GET /api/accounts/:username/export/txt`, `GET /api/accounts/:username/progress`, `GET /api/posts/:id`, `PUT /api/posts/:id`, `POST /api/search` | Fully replaced by `nest/content/content.controller.ts` (search is now `GET /api/v1/search`) |
| `modules/workspaces/workspaces.controller.ts` | `GET /api/workspaces`, `GET /api/workspaces/:id/members`, `PATCH /api/workspaces/:id`, `PUT /api/workspaces/:id/members/:userId`, `POST /api/workspaces/:id/members`, `DELETE /api/workspaces/:id/members/:userId`, `GET /api/workspaces/:id/brands`, `POST /api/workspaces/:id/brands` | Fully replaced by `nest/workspaces/workspaces.controller.ts` |
| `modules/workspaces/dashboard.controller.ts` | `GET /api/targets`, `PATCH /api/targets/:id` | Covered by `nest/intelligence/intelligence.controller.ts` |
| `modules/proactive/proactive.controller.ts` | `POST /api/generate-comment`, `POST /api/comment-feedback`, `POST /api/trigger-fanout`, `GET /api/brands/:brandId/intelligence`, `PUT /api/brands/:brandId/intelligence`, `PATCH /api/brands/:brandId/intelligence`, `GET /api/brands/:brandId/dna`, `GET /api/brands/:brandId/dna-light`, `GET /api/service/brands`, `PATCH /api/service/brands/:brandId`, `POST /api/targets`, `PUT /api/targets/:brandId/:username`, `DELETE /api/targets`, `POST /api/brands/:brandId/sync-owned-to-flownau` | Mostly replaced by `nest/intelligence/intelligence.controller.ts`. `sync-owned-to-flownau` has no NestJS equivalent yet. |
| `modules/content/inspo.controller.ts` | `POST /api/inspo`, `GET /api/inspo`, `GET /api/inspo/:id`, `POST /api/repost` | NestJS inspo routes exist at different paths: `nest/inspo/inspo.controller.ts` uses `/brands/:brandId/inspo` pattern. Old flat `/inspo` routes have no NestJS equivalent. |

### Routes that exist only in NestJS (`src/nest/`)

These routes were added directly in NestJS with no Fastify precedent:

- `nest/inspo/inspo.controller.ts`: `POST/GET /api/v1/brands/:brandId/inspo`, `PATCH/DELETE /api/v1/brands/:brandId/inspo/:id`, `GET /api/v1/inspo/:id`, `POST /api/v1/repost`, plus `_service/brands/:brandId/inspo` variants.
- `nest/intelligence/intelligence.controller.ts`: `GET /api/v1/targets` (with `projectId` support), `PUT /api/v1/targets/:id`, `POST /api/v1/capture-post` — all absent from Fastify.
- `nest/brand-context/brand-context.controller.ts`: entirely new, no Fastify equivalent.
- `nest/inspo/source-concept.controller.ts`, `nest/inspo/voicenote.controller.ts`: entirely new.
- `nest/workspaces/projects-proxy.controller.ts`, `nest/content/publishing.controller.ts`, `nest/content/social-profiles.controller.ts`: entirely new.

### Routes that exist in both (duplicate implementations)

All of the routes in the table above technically exist in both files, but only the NestJS versions are reachable in production since `app.ts` is not started.

---

## Why consolidate: the maintenance case

Even though Fastify is already dead in production, the Fastify code continues to:

1. **Compile alongside the NestJS app** — TypeScript errors in Fastify modules block builds.
2. **Import from shared BullMQ queues** — If a queue is renamed or refactored, both layers must be updated.
3. **Carry different auth semantics** — Fastify's `authenticate` middleware (`src/utils/auth.ts`) reads a `nau_token` cookie, while `AnyAuthGuard` reads `nau_at`. The Fastify layer also uses `x-nau-service-key` but compares it differently. Any security change must be applied in two places.
4. **Mislead future contributors** — A developer reading `src/modules/proactive/proactive.controller.ts` may believe those routes are live and make changes there instead of in `src/nest/intelligence/intelligence.controller.ts`.
5. **Retain a dead Prisma client instance** — `src/modules/shared/prisma.ts` creates a second `PrismaClient` that is never used in production, adding to cold-start time.

The correct end state is: delete `src/app.ts` and the entire `src/modules/` tree, leaving only `src/nest/` as the sole application layer.

---

## Auth guard semantics: mapping Fastify to NestJS

The Fastify `authenticate` middleware accepts:
- `x-nau-service-key` header matching `config.nauServiceKey`
- Bearer token in `Authorization` header (via `verifyJwt`)
- Cookie named `nau_token` (legacy cookie name)

The NestJS `AnyAuthGuard` accepts:
- `x-nau-service-key` header (same check, via `ConfigService`)
- Bearer token in `Authorization` header (via `@nau/auth` `verifyAccessToken`)
- Cookie named `nau_at` (current canonical name)

The `nau_token` cookie name in Fastify is a legacy artifact — the SPA and all live callers have been setting `nau_at` since the NestJS migration. No change in auth semantics is needed; the NestJS guards already handle all valid session types.

The `ServiceAuthGuard` in `nest/auth/service-auth.guard.ts` is used for `_service/` prefixed routes — this is more restrictive than `AnyAuthGuard` (service key only, no user JWT). Preserve this pattern when migrating any route that was previously service-only.

---

## Migration approach

Since the Fastify layer is already not running, this is a **cleanup migration**, not a live cutover. The risk is that some Fastify module contains logic not yet ported to NestJS, and deleting it before verifying the NestJS equivalent would silently drop a feature.

The approach:
1. For each Fastify module, verify the NestJS equivalent covers every route and matches the business logic.
2. If logic is missing in NestJS, port it before deleting the Fastify module.
3. Delete the Fastify module file.
4. Once all modules are gone, delete `src/app.ts`, `src/utils/auth.ts`, `src/utils/logger.ts` (if unused), `src/config/` (if unused), and `src/modules/shared/prisma.ts`.

**Route paths must not change.** The NestJS app sets `api/v1` as a global prefix (excluding `/health` and `/auth/**`). Fastify routes used `/api` (no version). Before deleting the Fastify layer, confirm the NestJS controllers are reachable at the same paths the dashboard SPA and any external callers use. If there is a mismatch, add NestJS aliases before removing Fastify.

---

## Specific action items per module

### 1. `src/modules/auth/auth.controller.ts`

NestJS equivalent: `src/nest/auth/auth-callback.controller.ts`

Coverage: complete. Routes `GET /auth/callback`, `GET /auth/me`, and `GET /auth/logout` are fully ported. Both implementations handle silent refresh via `nau_rt`. The NestJS version uses `cookieParser` middleware (registered in `main.ts`), so `req.cookies` works correctly.

Action: delete `src/modules/auth/auth.controller.ts`.

Complexity: low.

### 2. `src/modules/analytics/analytics.controller.ts`

NestJS equivalent: `src/nest/analytics/analytics.controller.ts`

Coverage: complete. All four queue management routes are ported. The NestJS `AnalyticsService` is the authoritative implementation and is also used by the CLAUDE.md-mandated queue registration pattern.

Action: delete `src/modules/analytics/analytics.controller.ts`.

Complexity: low.

### 3. `src/modules/ingestion/ingestion.controller.ts`

NestJS equivalent: `src/nest/ingestion/ingestion.controller.ts`

Coverage: complete. `POST /ingest`, `POST /abort`, `POST /pause`, `POST /resume`, `GET /ingest/status/:jobId` are all ported.

One difference: the Fastify version has a per-route rate limit on `POST /ingest` (`max: 5, timeWindow: '1 minute'`). Verify whether the NestJS layer has equivalent rate limiting; if not, add it before deleting Fastify.

Action: delete `src/modules/ingestion/ingestion.controller.ts`.

Complexity: low (one rate-limit check needed).

### 4. `src/modules/content/content.controller.ts`

NestJS equivalent: `src/nest/content/content.controller.ts`

Coverage: complete for all listed routes. One structural difference: Fastify exposed `POST /api/search` (body-based), NestJS exposes `GET /api/v1/search` (query params) and `PUT /api/v1/search` as a body fallback. If the dashboard SPA calls `POST /search`, the NestJS `PUT /search` handles it. Confirm the SPA is not sending `POST /search` before removing.

Action: delete `src/modules/content/content.controller.ts`.

Complexity: low (one HTTP method check).

### 5. `src/modules/content/inspo.controller.ts`

NestJS equivalent: `src/nest/inspo/inspo.controller.ts`

Coverage: partial mismatch. The Fastify routes use a flat URL structure:
- `POST /api/inspo` (create, takes `brandId` in body)
- `GET /api/inspo?brandId=` (list)
- `GET /api/inspo/:id` (get one)
- `POST /api/repost`

The NestJS routes use a nested structure:
- `POST /api/v1/brands/:brandId/inspo`
- `GET /api/v1/brands/:brandId/inspo`
- `GET /api/v1/inspo/:id`
- `POST /api/v1/repost`

If the dashboard SPA uses the flat Fastify paths, they need to be migrated in the SPA before the Fastify layer is removed. The `POST /repost` path matches modulo the version prefix.

Also note: the Fastify inspo module uses `x-nau-service-key` auth (via `authenticate`), while the NestJS inspo controller uses `JwtAuthGuard` for user routes and `ServiceAuthGuard` for `_service/` routes. This is the correct new pattern — service callers should migrate to `_service/` prefixed routes.

Action: audit SPA fetch calls for `/api/inspo` and `/api/repost` paths; update SPA to use new NestJS paths; then delete `src/modules/content/inspo.controller.ts`.

Complexity: medium (SPA path migration required).

### 6. `src/modules/workspaces/workspaces.controller.ts`

NestJS equivalent: `src/nest/workspaces/workspaces.controller.ts`

Coverage: complete. Both proxy to `api.9nau.com`. NestJS version adds `GET/POST /workspaces/:id/projects` which Fastify lacked.

Action: delete `src/modules/workspaces/workspaces.controller.ts`.

Complexity: low.

### 7. `src/modules/workspaces/dashboard.controller.ts`

NestJS equivalent: `src/nest/intelligence/intelligence.controller.ts`

Coverage: the Fastify dashboard controller exposes `GET /api/targets` and `PATCH /api/targets/:id` without auth. The NestJS intelligence controller exposes `GET /api/v1/targets` (with `AnyAuthGuard`) and `PATCH /api/v1/targets/:id`. The auth gap is a security improvement, not a regression.

However, the Fastify `GET /targets` query filters on `socialProfileId: { not: null }` and includes a post-count subquery — verify the NestJS `getProfileMemberships` service method returns equivalent data.

Action: delete `src/modules/workspaces/dashboard.controller.ts` after verifying NestJS service output.

Complexity: low.

### 8. `src/modules/proactive/proactive.controller.ts`

NestJS equivalent: `src/nest/intelligence/intelligence.controller.ts`

Coverage: mostly complete. Ported routes: `generate-comment`, `comment-feedback`, `trigger-fanout`, `brands/:brandId/intelligence` (GET/PUT/PATCH), `brands/:brandId/dna`, `brands/:brandId/dna-light`, `service/brands` (GET), `service/brands/:brandId` (PATCH), `targets` (POST/PUT/DELETE).

Not yet ported: `POST /api/brands/:brandId/sync-owned-to-flownau`. This endpoint syncs nauthenticity-owned social profiles into flownau. It uses the deprecated `X-Nau-Service-Key` header to call flownau — any NestJS port should use signed service JWTs instead. Confirm whether this endpoint is still needed or if the sync happens through another mechanism before porting.

Also note: Fastify `PUT /api/targets/:brandId/:username` (lookup by username + category query param) differs from the NestJS `PUT /api/v1/targets/:id` (lookup by membership ID). The old shape is more complex; ensure no caller still uses the username-based form.

Action: port `sync-owned-to-flownau` to NestJS or confirm it is unused; then delete `src/modules/proactive/proactive.controller.ts`.

Complexity: medium (`sync-owned-to-flownau` port + auth header update, URL shape change on `PUT /targets`).

---

## Dead infrastructure to remove after all modules are gone

Once all `src/modules/` route files are confirmed dead:

| File | Reason to delete |
|---|---|
| `src/app.ts` | Fastify bootstrap — no longer started |
| `src/modules/shared/prisma.ts` | Second `PrismaClient` instance, unused |
| `src/utils/auth.ts` | Fastify `authenticate` middleware |
| `src/utils/jwt.ts` | Called only by `authenticate` |
| `src/utils/logger.ts` | Fastify-specific logger (NestJS uses `@nau/logger`) |
| `src/utils/errorHandler.ts` | Fastify error handler |
| `src/config/env.ts`, `src/config/index.ts` | If only consumed by Fastify modules |
| `src/scheduler.ts` | Confirm whether the scheduler is now handled by NestJS `SchedulerModule`; if yes, delete |

Check `src/queues/` — the BullMQ workers and queue definitions may already be imported by the NestJS module tree. If so, the Fastify-era queue imports in `app.ts` are the last consumers and can go. Do not delete queue definitions themselves.

---

## Testing during migration

Because the Fastify layer is already not running, "testing during migration" means verifying NestJS coverage, not verifying live parity.

For each module being deleted:

1. **Route coverage check** — compare every `fastify.get/post/put/patch/delete` call in the module file against the NestJS controller. List any paths not present in NestJS.
2. **Auth semantics check** — confirm the NestJS route uses the correct guard (`AnyAuthGuard`, `JwtAuthGuard`, or `ServiceAuthGuard`) for the intended caller type.
3. **Manual smoke test** — call the NestJS route via the dashboard SPA or `curl` with a valid session cookie. For service routes, use a signed service JWT.
4. **Log comparison** — in production, check `docker logs nauthenticity` for 404 errors on routes that were just cleaned up. If callers were hitting the Fastify-only routes (which would 404 since `app.ts` isn't running), the 404s would already be in the logs.

The simplest integration test is: check production logs for any `404` on paths listed in the Fastify modules. If a path is 404-ing, it means either: (a) a caller is using the old URL shape, or (b) the NestJS equivalent isn't registered correctly.

---

## Suggested order (easiest to hardest)

| Order | Module | Complexity | Blocker |
|---|---|---|---|
| 1 | `modules/auth/auth.controller.ts` | Low | None — NestJS is complete |
| 2 | `modules/analytics/analytics.controller.ts` | Low | None — NestJS is complete |
| 3 | `modules/ingestion/ingestion.controller.ts` | Low | Verify rate limiting on `POST /ingest` |
| 4 | `modules/workspaces/workspaces.controller.ts` | Low | None — NestJS is complete |
| 5 | `modules/workspaces/dashboard.controller.ts` | Low | Verify NestJS targets query parity |
| 6 | `modules/content/content.controller.ts` | Low | Confirm SPA uses GET or PUT, not POST, for `/search` |
| 7 | `modules/proactive/proactive.controller.ts` | Medium | Port `sync-owned-to-flownau`; confirm `PUT /targets` URL shape change is safe |
| 8 | `modules/content/inspo.controller.ts` | Medium | SPA must be updated to new `/brands/:brandId/inspo` paths |
| 9 | Dead infrastructure cleanup | Low | All modules above must be gone first |

---

## What to do with the Fastify app once all routes are migrated

1. Delete `src/app.ts` — this removes the Fastify bootstrap. Remove its import from any test or script file.
2. Remove Fastify and its plugins from `package.json` dependencies: `fastify`, `@fastify/cors`, `@fastify/static`, `@fastify/rate-limit`. Run `pnpm install` to update the lockfile.
3. Delete the Fastify utilities listed in the table above.
4. Run `pnpm --filter nauthenticity build` to confirm TypeScript is clean with no references to deleted files.
5. Deploy — the resulting image will be meaningfully smaller (Fastify + plugins + its dead module tree removed).

Do not keep `src/app.ts` as a "local dev alternative". It is misleading and will drift. If a dev-only entry point is needed, it should be `src/main.ts` with appropriate env variables set.
