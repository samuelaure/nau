# Test Coverage Plan — naŭ Platform

> Status: planning. No tests existed at the time of writing except those noted under each service.
> This document is a living spec — cross-reference actual file paths as the codebase evolves.

---

## 1. Testing philosophy

### What kind of tests make sense where

The platform is a pipeline system. Data enters (scraping, captures, cron triggers), is transformed through workers and services, and exits (Instagram API, Zazu, Flownau). The testing strategy mirrors that shape:

| Layer | Approach | Why |
|---|---|---|
| Pure functions with clear inputs/outputs | Unit tests, no mocks | Fast, deterministic, no infra |
| NestJS services with Prisma | Unit tests with `jest-mock-extended` | Already established pattern; avoids DB spin-up cost in most cases |
| DB constraint logic (partial indexes, XOR rules) | Integration tests against a real test Postgres | Prisma mocks cannot enforce DB-level constraints |
| HTTP controllers | Integration tests with `supertest` + NestJS `Test.createTestingModule` | Validates routing, guards, serialization in one pass |
| BullMQ workers | Unit tests on the processor function extracted from the `Worker` constructor | Workers are untestable as instantiated; extract the handler |
| External APIs (Apify, Instagram Graph, OpenAI) | Mock at the service boundary (`apify.service.ts`, `intelligence.service.ts`, IG publisher functions) | Never hit real APIs in CI |
| Cross-service webhooks | Integration tests against a test instance of the receiving service | The only way to verify the full contract |
| UI (nauthenticity dashboard, flownau cron routes) | Component tests with Vitest + Testing Library for units; Playwright for critical flows | Playwright reserved for flows that span auth + data |

### What NOT to test

- Prisma query internals — if `prisma.post.upsert` is called with the right args, the framework handles execution
- NestJS DI wiring — `@Module` decorators, provider registration
- Logger output — `logger.info(...)` calls are not behaviour
- Implementation details inside a loop that could be refactored — test the outcome, not the iteration count
- Re-testing framework behaviour (`zod.parse`, `date-fns-tz.toZonedTime`) — trust the library

### Priority ranking

1. **nauthenticity worker pipeline** — `ingestProfile`, `runProactiveFanout`, `capturePost`, `recoverStuckRuns`. Highest data-integrity risk. No tests today.
2. **nauthenticity DB constraints** — `CategoryMembership` XOR constraint, `upsertSocialProfile` dedup. Enforced only at DB level; mocked Prisma cannot catch regressions.
3. **flownau publish flow** — `publishComposition` format dispatch, `runPublisher` status filtering, trial reel fallback. Money path.
4. **api identity endpoints** — Brands, Workspaces, SocialProfiles CRUD + the `sync` webhook forwarding to Flownau.
5. **Auth guards** — Already partially covered; extend to cover edge cases.
6. **nauthenticity dashboard** — Low risk, low priority; add after core pipeline is covered.

---

## 2. api service (`apps/api`)

### Current state

Jest + `jest-mock-extended`. Several spec files exist (`blocks`, `events`, `schedule`, `relations`, `integrations/flownau.service`). All mock Prisma. No test DB. CI runs in `ci-api.yml` without a Postgres service container.

### What to add

**Integration tests against a real test Postgres**

The api owns identity. The most important correctness questions are about FK relationships and unique constraints that mocked Prisma cannot verify. Add a `test:integration` script that uses a Testcontainers-managed Postgres (or the existing `.env.test` `DATABASE_URL` pattern that nauthenticity already scaffolds).

Target files and scenarios:

- `apps/api/src/brands/brands.service.ts`
  - Creating a Brand under a Workspace FK-enforces the Workspace exists
  - Deleting a Brand cascades correctly
  - `brandId` is bare UUID, never prefixed — regression guard for the naming rule

- `apps/api/src/social-profiles/` (if it exists) or wherever SocialProfiles are managed
  - Unique constraint on `(platform, username)` is enforced
  - Updating a SocialProfile's `username` does not create a duplicate

- `apps/api/src/sync/sync.service.ts`
  - `push()` with a `content_idea` block correctly calls `FlownauIntegrationService.ingestIdeas`
  - `push()` with a non-`content_idea` block does NOT call `ingestIdeas`
  - `push()` when `ingestIdeas` throws sets `flownauSyncStatus: 'error'` on the block
  - `pull()` returns only blocks updated after `lastSyncedAt`

- `apps/api/src/integrations/flownau.service.ts` — already has a spec; verify the HTTP call shape matches what Flownau's `/api/v1/ideation/ingest` route expects

**Unit tests (mock Prisma, already the pattern)**

- `apps/api/src/brands/brands.service.ts` — CRUD happy paths, not-found 404 paths
- `apps/api/src/workspaces/` — workspace-member access control (if enforced in service layer)
- `apps/api/src/projects/` — Project creation, FK to Brand

### What to mock

- All external HTTP calls (`FlownauIntegrationService` wraps `fetch` — mock the `fetch` or the service class)
- Never mock Prisma in integration tests; let it hit the test DB

---

## 3. nauthenticity service (`apps/nauthenticity`)

### Current state

Jest + `jest-mock-extended`. Existing tests cover: `JwtAuthGuard`, `ServiceAuthGuard`, auth security scenarios, `InspoService` CRUD, `SourceConceptService` unit test (partial), `compute.worker` phase/label mapping, `retry` utility. CI in `ci-nauthenticity.yml` runs without a Postgres service container (all Prisma is mocked).

The following critical areas have **zero coverage** and need it most.

### 3a. `upsertSocialProfile` dedup

File: `apps/nauthenticity/src/modules/shared/upsert-social-profile.ts`

This function has two lookup paths (externalId → username fallback) and is called from both `ingestProfile` and `runProactiveFanout`. A regression here causes duplicate SocialProfile rows and broken FK chains.

Unit tests (mock Prisma with `jest-mock-extended`):

```
upsertSocialProfile — when externalId is provided and record exists
  → calls prisma.socialProfile.findFirst with { platform, externalId }
  → calls prisma.socialProfile.update (not upsert)
  → returns the updated record

upsertSocialProfile — when externalId is provided but no record exists
  → calls prisma.socialProfile.findFirst → null
  → calls prisma.socialProfile.upsert with the externalId in create payload

upsertSocialProfile — when externalId is null
  → skips findFirst
  → calls prisma.socialProfile.upsert by (platform, username)

upsertSocialProfile — extraUpdate fields are passed through in both paths
```

Integration test (real Postgres via Testcontainers or `.env.test`):

```
First call with username only → creates record
Second call with same username + externalId → updates externalId on existing row, no duplicate
Third call with renamed username but same externalId → updates username, still one row
Concurrent calls with same username → only one row (unique constraint)
```

### 3b. `CategoryMembership` XOR constraint

File: `apps/nauthenticity/prisma/schema.prisma` (partial unique indexes in migration SQL)

The XOR rule — exactly one of `(socialProfileId, postId)` must be set — is enforced by two partial unique indexes, not a Prisma-level constraint. Mocked Prisma will never catch a violation.

Integration tests (real Postgres required):

```
Insert with socialProfileId set, postId null → succeeds
Insert with postId set, socialProfileId null → succeeds
Insert with both set → should fail (or be prevented by application logic)
Insert duplicate (brandId, category, socialProfileId) with postId null → fails unique constraint
Insert duplicate (brandId, category, postId) with socialProfileId null → fails unique constraint
Insert same brandId+category with different socialProfileId → succeeds (different target)
```

These tests go in a new file: `apps/nauthenticity/src/modules/shared/__tests__/category-membership.integration.test.ts`

### 3c. `ingestProfile` (ingester)

File: `apps/nauthenticity/src/modules/ingestion/ingester.ts`

This is the most complex function in the codebase. It cannot be tested as-is because it directly imports `prisma` and calls `runInstagramScraper`. Extract the Apify call behind the already-existing `apify.service.ts` boundary; mock that service.

Unit tests (mock `prisma` module + `apify.service` + `downloadQueue`):

```
ingestProfile — uses cached ScrapingRun when one exists within 24h and has enough items
  → runInstagramScraper is NOT called
  → items from cachedRun.rawData are processed

ingestProfile — skips items without a URL or shortcode (logs warn, continues)

ingestProfile — upserts Post by url (dedup key)
  → second call with same url updates likes/comments, does not create a second row

ingestProfile — queues media download only when storageUrl === url (not yet downloaded)
  → media already moved to R2 is not re-queued

ingestProfile — collaborator SocialProfiles are upserted for co-authors and origin owners

ingestProfile — with updateSync=true, passes oldestPostDate to runInstagramScraper

ingestProfile — individual post errors are caught and logged; other posts continue
```

Because `ingestProfile` is a module-level export that imports `prisma` at the top level, the test needs to use `jest.mock('../../modules/shared/prisma')` and `jest.mock('../../services/apify.service')`. The existing `__mocks__/empty-module.js` pattern handles `dotenv`; the same approach works here.

### 3d. `runProactiveFanout` (fanout processor)

File: `apps/nauthenticity/src/modules/proactive/fanout.processor.ts`

The `isInWindow` function is already pure and trivially unit-testable. The `runProactiveFanout` function is the target.

Unit tests for `isInWindow` (no mocks needed):

```
isInWindow — windowStart and windowEnd are null → false
isInWindow — current time inside [09:00, 17:00] → true
isInWindow — current time outside [09:00, 17:00] → false
isInWindow — midnight-crossing window [22:00, 06:00], time at 23:30 → true
isInWindow — midnight-crossing window [22:00, 06:00], time at 12:00 → false
```

Unit tests for `runProactiveFanout` (mock `prisma`, `runUniversalBatchInstagramScraper`, `generateCommentSuggestions`, `dispatchToZazu`):

```
runProactiveFanout — no brands → returns early

runProactiveFanout — brand with no COMMENT memberships → no scraping call

runProactiveFanout — brand in-window, profile lastScrapedAt 10 min ago → 15min threshold → still eligible → scraping called

runProactiveFanout — brand out-of-window, profile lastScrapedAt 30 min ago → 60min threshold → not eligible → scraping NOT called

runProactiveFanout — post already in CommentFeedback for this brand → skipped (alreadyProcessed guard)

runProactiveFanout — multiple brands interested in same profile → single scrape call, suggestions generated for each brand separately

runProactiveFanout — Apify batch scraping throws → logged, does not rethrow (runProactiveFanout itself resolves)

runProactiveFanout — generateCommentSuggestions throws for one brand → logged, other brands continue
```

### 3e. `capturePost` dedup

File: `apps/nauthenticity/src/nest/intelligence/intelligence.service.ts`, method `capturePost` (~line 200)

Unit tests (mock `prisma`, `downloadQueue`, `scrapePostByUrl`):

```
capturePost — post already exists, all media downloaded (storageUrl ≠ url) → no Apify call, no download queue job, creates CategoryMembership only

capturePost — post exists, some media not downloaded → download queue jobs added only for undownloaded media

capturePost — post does not exist → scrapePostByUrl called, post created, CategoryMembership created

capturePost — scrapePostByUrl returns null → throws NotFoundException

capturePost — called twice with same postUrl for same brand → second call finds existing post, creates/updates membership without duplication
```

### 3f. `recoverStuckRuns`

File: `apps/nauthenticity/src/nest/workers/workers.service.ts`

Unit tests (mock `prisma`, `optimizationQueue`, `computeQueue`):

```
recoverStuckRuns — run in 'downloading' phase, all media have storageUrl → re-triggers optimizationQueue

recoverStuckRuns — run in 'downloading' phase, some media still null storageUrl → skipped (still downloading)

recoverStuckRuns — run in 'downloading' phase, all media have non-/raw/ storageUrl → skips to 'visualizing', adds computeQueue job

recoverStuckRuns — run in 'optimizing' phase, all media optimized → adds computeQueue 'visualize-batch' job

recoverStuckRuns — no stuck runs → no queue jobs added
```

### 3g. NestJS controllers (HTTP layer)

Use `supertest` + `Test.createTestingModule` with real NestJS context but mocked services (not mocked Prisma — mock the service class).

Priority controllers:

- `apps/nauthenticity/src/nest/ingestion/ingestion.controller.ts` — `POST /ingestion/start` accepts `{ username, limit }`, queues job
- `apps/nauthenticity/src/nest/intelligence/intelligence.controller.ts` — `POST /brands/:brandId/capture` (capturePost entry), auth guard enforced
- `apps/nauthenticity/src/nest/inspo/source-concept.controller.ts` — `POST /brands/:brandId/source-concepts/generate`
- `apps/nauthenticity/src/nest/content/publishing.controller.ts` — `PUT /social-profile-targets/:membershipId/publishing`

For each: test that unauthenticated requests return 401, authenticated requests route to the correct service method, and that 404/422 from the service maps to the correct HTTP status.

### Tooling for nauthenticity

- Jest 29 + ts-jest (already installed)
- `jest-mock-extended` (already installed) for Prisma mocking in unit tests
- `supertest` (already installed) for controller integration tests
- `@testcontainers/postgresql` (new) for DB constraint integration tests — add to `devDependencies`
- Add a `test:integration` script in `package.json`: `dotenv -e ../../.env.test -e .env.test -- jest --testPathPattern=integration`

---

## 4. nauthenticity dashboard (`apps/nauthenticity/src` — Vite React SPA in dashboard dir)

### Current state

No tests.

### Recommended tooling

Vitest + `@testing-library/react` + `@testing-library/user-event`. This is already the pattern in `apps/flownau` (Vitest). Do not add Playwright to the dashboard in the near term — the dashboard is an internal tool with narrow surface area.

### What to test

Component tests (Vitest + Testing Library):

- Queue status panel — renders correct counts from mocked API response; "Retry" button calls the correct endpoint
- Ingestion trigger form — `POST /ingestion/start` is called with the entered username
- Profile list — renders profile cards; clicking a profile navigates to detail view

Do NOT write Playwright e2e for the dashboard now. The component tests catch the real failure modes (wrong API endpoint, broken state update). Playwright adds significant CI overhead for a tool that only internal users see.

If Playwright is added later, the single critical flow to cover is: log in → trigger ingestion → observe progress update → confirm run appears in queue view.

---

## 5. flownau (`apps/flownau`)

### Current state

Vitest. Existing tests: `publisher/__tests__/route.test.ts` (publisher cron), `publisher/__tests__/instagram-token.test.ts`, `renderer/__tests__/render-queue.test.ts`, `planning/__tests__/daily-plan.service.test.ts`, `ideation/__tests__/`, `video/utils/__tests__/assets.test.ts`, `utils/infra.test.ts`. The publisher cron test is a good model.

### What to add

**`buildCaption` in `publish-orchestrator.ts`** — pure function, zero cost to test:

```
buildCaption — null caption → 'New content'
buildCaption — caption with hashtags → appended with double newline
buildCaption — hashtags without # prefix → prefix added
buildCaption — hashtags already prefixed → not double-prefixed
```

**`publishComposition` in `publish-orchestrator.ts`** — mock `refreshTokenIfNeeded`, `publishReel`, `publishTrialReel`, `publishCarousel`, `publishPhoto`, `prisma`:

```
publishComposition — missing platformId → returns { success: false, error: '...' }
publishComposition — missing videoUrl → returns { success: false, error: '...' }
publishComposition — token refresh fails → returns { success: false, error: 'Token refresh failed: ...' }
publishComposition — format 'reel' → calls publishReel
publishComposition — format 'trial_reel', IG error subcode 2207081 → falls back to publishReel, updates post format to 'reel'
publishComposition — format 'carousel' → splits videoUrl on comma, calls publishCarousel
publishComposition — format 'single_image' → calls publishPhoto
publishComposition — format 'unknown' → returns { success: false, error: 'Unknown format: ...' }
publishComposition — success → updates post to PUBLISHED, calls onPostPublished
```

**`runPublisher` in `internal-cron.ts`** — mock `prisma`, `publishComposition`:

```
runPublisher — RENDERED_PENDING post is in query results (status filter) → confirm it is never published (the guard inside the loop)
runPublisher — publishAttempts >= 3 → post is excluded by query (publishAttempts: { lt: 3 })
runPublisher — publishComposition returns success → prisma.contentPlanner.updateMany called with lastPostedAt
runPublisher — publishComposition throws → publishAttempts incremented, lastPublishError set
runPublisher — post with no socialProfile accessToken → skipped (continue guard)
```

**`runRenderer` in `internal-cron.ts`** — mock `prisma`, `renderQueue`:

```
runRenderer — RENDERING post updated more than 15 min ago, job in 'active' state → NOT reset
runRenderer — RENDERING post, job in null state (lost) → reset to DRAFT_PENDING
runRenderer — DRAFT_APPROVED post, USER_MANAGED_FORMATS format, no userUploadedMediaUrl → skipped
runRenderer — DRAFT_APPROVED post → addRenderJob called, status updated to RENDERING
```

**`onPostPublished` in `post-published.ts`** — mock `prisma`, `runCoverageChecks`:

```
onPostPublished → postSlot.updateMany called with { postId }
onPostPublished → runCoverageChecks called with brandId (fire-and-forget, errors caught)
```

### What NOT to add in flownau

- Remotion render output tests — this is rendering infrastructure, not application logic
- Tests for every cron route handler that just calls a function — test the function, not the wrapper

---

## 6. Cross-service: api → nauthenticity sync webhook

### The flow

When a Brand or Project changes in `api`, it calls nauthenticity via a service JWT. This is the highest-risk cross-service integration: if the payload shape diverges, nauthenticity silently ignores or errors on the data.

### How to test it

**Contract test** (preferred over full e2e): Run a real nauthenticity NestJS app in the test process (using `Test.createTestingModule` with real Prisma pointing at a test DB), and call its HTTP endpoint with the same payload shape that `api`'s integration service sends.

Files:
- Sender: `apps/api/src/integrations/flownau.service.ts` — this actually calls Flownau, not nauthenticity directly. The api→nauthenticity webhook lives in `apps/api/src/sync/` or a nauthenticity-specific integration service (check `apps/api/src/integrations/`).
- Receiver: `apps/nauthenticity/src/nest/` — identify the controller that accepts brand sync events.

Contract test location: `apps/nauthenticity/src/nest/__tests__/brand-sync.contract.test.ts`

Scenarios:

```
Brand created event → Brand row upserted in nauthenticity DB with correct workspaceId
Brand updated event (name change) → existing row updated, no duplicate
Project created event → Project row upserted with correct brandId FK
Deleted event with deletedAt set → soft-delete applied
Invalid service JWT → 401 returned
```

Run this test only in the `test:integration` script (requires real DB), not in the standard `jest` run.

---

## 7. Tooling recommendations

### Per service

| Service | Test runner | Key libraries | Notes |
|---|---|---|---|
| `api` | Jest 29 + ts-jest | `jest-mock-extended`, `supertest`, `@testcontainers/postgresql` | Add Testcontainers for integration tests |
| `nauthenticity` | Jest 29 + ts-jest | `jest-mock-extended`, `supertest`, `@testcontainers/postgresql` | Add Testcontainers; already has `supertest` in devDeps |
| `flownau` | Vitest | `vitest`, `@vitest/coverage-v8` | Already configured |
| nauthenticity dashboard | Vitest | `@testing-library/react`, `@testing-library/user-event`, `jsdom` | New setup needed |

### Testcontainers setup for DB integration tests

Both `api` and `nauthenticity` should share the same pattern:

```ts
// test-utils/postgres.ts (per service)
import { PostgreSqlContainer } from '@testcontainers/postgresql'

let container: Awaited<ReturnType<typeof new PostgreSqlContainer().start>>

export async function startTestDb() {
  container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start()
  process.env.DATABASE_URL = container.getConnectionUri()
  // run prisma migrate deploy
}

export async function stopTestDb() {
  await container.stop()
}
```

Use `globalSetup` / `globalTeardown` in Jest config for the integration suite so the container starts once per test run.

### Coverage targets (pragmatic, not arbitrary)

Do not set a blanket coverage percentage. Instead, set coverage requirements on specific modules:

```js
// jest.config.js
coverageThreshold: {
  'src/modules/shared/upsert-social-profile.ts': { branches: 100, functions: 100 },
  'src/modules/proactive/fanout.processor.ts': { branches: 80, functions: 100 },
  'src/modules/ingestion/ingester.ts': { branches: 70, functions: 100 },
}
```

---

## 8. Priority order

Given the current state (workers running 24/7, schema constraints enforced only at DB level, no integration tests for DB logic), implement in this order:

### Phase 1 — Immediate (highest data-integrity risk)

1. **`upsertSocialProfile` unit tests** — 30 minutes, pure logic, already has the jest-mock-extended pattern. A rename bug here silently corrupts the profile graph.

2. **`isInWindow` unit tests** — 15 minutes, pure function, timezone edge cases are real failure modes. Already exportable from `fanout.processor.ts`.

3. **`runProactiveFanout` unit tests** — 2 hours. Mock Apify, Prisma, Zazu dispatcher. The dedup guard (`alreadyProcessed`) and the threshold logic are the critical branches.

4. **`capturePost` unit tests** — 2 hours. The dedup branch (post exists, all downloaded vs partial) is the most important.

### Phase 2 — Next sprint (DB constraint regression guards)

5. **`CategoryMembership` XOR integration tests** — requires Testcontainers setup (half day to configure, tests themselves are 1 hour). The partial unique indexes are invisible to unit tests and are easy to break in migrations.

6. **`upsertSocialProfile` integration test** — once Testcontainers is set up, add the rename/concurrent scenarios (1 hour).

### Phase 3 — Publish pipeline hardening

7. **`publishComposition` unit tests** — 2 hours. The trial reel fallback (subcode 2207081) is a known production path. The format dispatch switch is easy to break silently.

8. **`runPublisher` unit tests** — 1 hour. The `RENDERED_PENDING` guard is the most important branch (it was a recent production bug).

9. **`recoverStuckRuns` unit tests** — 1.5 hours. Recovery logic is boot-time critical.

### Phase 4 — Controller integration tests

10. `ingestion.controller`, `intelligence.controller`, `publishing.controller` — supertest + NestJS test module. Verify auth guards, routing, and error mapping.

### Phase 5 — Cross-service contract

11. Brand sync contract test. Requires integration DB setup (from Phase 2).

### Phase 6 — Coverage fill

12. `ingestProfile` unit tests — complex, but lower urgency than the above because the dedup key (`url`) is already well-tested in production.

13. nauthenticity dashboard component tests.

---

## 9. CI integration

### Current state

Each service has its own workflow in `.github/workflows/`. Tests run in the `test` job before `build` and `publish`. No workflow currently spins up a Postgres service container.

### Changes needed

**`ci-nauthenticity.yml` and `ci-api.yml`** — add two job variants:

```yaml
jobs:
  unit-tests:
    # existing job — no DB, runs fast
    name: Unit tests

  integration-tests:
    name: Integration tests (DB)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: ci
          POSTGRES_PASSWORD: ci
          POSTGRES_DB: ci_nauthenticity
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    env:
      DATABASE_URL: postgresql://ci:ci@localhost:5432/ci_nauthenticity
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build --filter='./packages/**'
      - run: pnpm --filter=nauthenticity exec npx prisma migrate deploy
      - run: pnpm --filter=nauthenticity test:integration
```

The `build` and `publish` jobs should `needs: [unit-tests, integration-tests]`.

**Testcontainers as an alternative**: If the `services:` block adds too much CI complexity (e.g., you want the same test script locally without Docker Compose), use `@testcontainers/postgresql` in `globalSetup`. Testcontainers automatically uses the Docker socket available in GitHub Actions runners. The trade-off is slower startup vs simpler config.

**`ci-flownau.yml`** — add `vitest --run --coverage` to the test step. Coverage report uploaded as artifact. No DB service needed (Prisma is mocked in all current flownau tests via `vi.mock`).

**Test isolation principle**: Unit tests (mock Prisma) must never need a DB service container in CI. Integration tests must never be mixed into the same Jest run as unit tests — use separate `testPathPattern` globs (`integration.test.ts` suffix) and separate npm scripts (`test` vs `test:integration`).
