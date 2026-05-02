# Testing Guide — nau-platform

This document is the canonical reference for the testing architecture of the nau-platform monorepo. It explains **what** is tested, **why** each layer exists, **how** to run tests locally, and **how to extend** the suite when adding new features or apps.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Test layers](#2-test-layers)
3. [Per-app test configuration](#3-per-app-test-configuration)
4. [CI workflows](#4-ci-workflows)
5. [E2E tests with Playwright](#5-e2e-tests-with-playwright)
6. [Security test strategy](#6-security-test-strategy)
7. [Running tests locally](#7-running-tests-locally)
8. [Adding tests for a new feature](#8-adding-tests-for-a-new-feature)
9. [Adding tests for a new app](#9-adding-tests-for-a-new-app)
10. [Environment variables](#10-environment-variables)
11. [Coverage policy](#11-coverage-policy)
12. [Known gaps and future work](#12-known-gaps-and-future-work)

---

## 1. Architecture overview

```
nau-platform/
├── apps/
│   ├── api/            ← Jest unit tests (NestJS)
│   ├── nauthenticity/  ← Jest unit tests (NestJS)
│   ├── accounts/       ← Vitest unit tests (Next.js server actions)
│   ├── app/            ← Vitest unit tests (Next.js components/hooks)
│   ├── flownau/        ← Vitest unit tests (Next.js + Remotion)
│   ├── zazu-bot/       ← Vitest unit tests (Express/Telegraf)
│   ├── zazu-dashboard/ ← Vitest unit tests (Next.js + Telegram auth)
│   ├── whatsnau/
│   │   └── packages/backend/ ← Vitest unit tests
│   └── mobile/         ← Jest unit tests (Expo/React Native)
├── tests/
│   └── e2e/            ← Playwright E2E tests (all apps)
├── playwright.config.ts
└── TESTING.md          ← you are here
```

### Tooling decisions

| Layer | Tool | Rationale |
|-------|------|-----------|
| NestJS unit tests | **Jest** + `@nestjs/testing` | Default NestJS toolchain; all existing specs use Jest |
| Next.js / Node unit tests | **Vitest** | 10-50× faster than Jest for ESM/TypeScript apps |
| React Native unit tests | **Jest** + `jest-expo` | Only viable option for Expo apps |
| E2E tests | **Playwright** | Multi-tab support, superior auth state management, better CI reports than Cypress |
| Prisma mocking | **jest-mock-extended** | Type-safe Prisma mocks without real DB connections |
| API mocking | **vi.fn() / jest.fn()** | Inline mocks preferred for simplicity; `msw` can be added if needed |

---

## 2. Test layers

### Layer 1: Unit tests

**What**: Individual functions, classes, services, guards, and utilities in isolation.

**What gets mocked**: Everything external to the unit under test — Prisma, HTTP requests (fetch), external SDKs (Apify, OpenAI, Telegraf), Next.js APIs (cookies, headers), environment variables.

**What does NOT get mocked**: The internal logic of the unit itself. If you find yourself mocking the thing you're testing, that's a sign you're writing the wrong kind of test.

**File conventions**:
- NestJS apps: `*.spec.ts` in `src/**/__tests__/` or alongside the source file
- Next.js / Node apps: `*.test.ts` or `*.spec.ts` in `src/**/__tests__/` or `app/**/__tests__/`

### Layer 2: Integration tests (security-focused)

**What**: Tests that wire together multiple real components (e.g., NestJS module + guard + controller) to verify security contracts.

**Where**: `src/common/guards/security.spec.ts` in api and nauthenticity.

**Key scenarios covered**:
- Auth tokens are rejected when absent, expired, or tampered
- Service tokens are not accepted where user tokens are expected (and vice versa)
- Error responses do not leak secrets, stack traces, or user-existence information

### Layer 3: E2E tests (Playwright)

**What**: Full browser tests against running app instances. Covers critical user flows from the browser's perspective.

**See**: [Section 5 — E2E tests with Playwright](#5-e2e-tests-with-playwright)

---

## 3. Per-app test configuration

### `apps/api` — NestJS

| | |
|---|---|
| **Framework** | Jest + `@nestjs/testing` + `ts-jest` |
| **Config** | `apps/api/jest.config.js` |
| **Mocking** | `jest-mock-extended` for Prisma, `jest.fn()` for everything else |
| **Run** | `pnpm --filter=api test` |
| **Coverage** | `pnpm --filter=api test:cov` |
| **CI** | `.github/workflows/ci-api.yml` |

Spec files are colocated with source files (`*.spec.ts`). The test database is mocked — `PrismaService` is replaced with a `MockProxy<PrismaService>` in each spec that needs DB access.

**Key specs**:
- `src/common/guards/security.spec.ts` — security integration tests
- `src/blocks/blocks.service.spec.ts` — block CRUD with mocked Prisma
- `src/health/health.controller.spec.ts` — health endpoint contract

### `apps/nauthenticity` — NestJS

| | |
|---|---|
| **Framework** | Jest + `@nestjs/testing` + `ts-jest` |
| **Config** | `apps/nauthenticity/jest.config.js` |
| **Mocking** | `jest-mock-extended` for Prisma, `jest.mock('@nau/auth')` for auth helpers |
| **Run** | `pnpm --filter=nauthenticity test` |
| **Coverage** | `pnpm --filter=nauthenticity test:cov` |
| **CI** | `.github/workflows/ci-nauthenticity.yml` |

**Key specs**:
- `src/nest/auth/__tests__/jwt-auth.guard.spec.ts` — JWT guard for user tokens
- `src/nest/auth/__tests__/service-auth.guard.spec.ts` — guard for machine tokens
- `src/nest/auth/__tests__/security.spec.ts` — cross-guard security contracts
- `src/nest/inspo/__tests__/inspo.service.spec.ts` — InspoBase CRUD + ownership
- `src/nest/scraping/__tests__/scraping.service.spec.ts` — scraping orchestration
- `src/config/env.test.ts` — environment variable validation
- `src/queues/__tests__/compute.test.ts` — pipeline phase label uniqueness

### `apps/accounts` — Next.js 14

| | |
|---|---|
| **Framework** | Vitest |
| **Config** | `apps/accounts/vitest.config.ts` |
| **Environment** | `node` (server actions don't need jsdom) |
| **Mocking** | `vi.mock('next/headers')`, `vi.mock('@nau/auth')`, `vi.stubGlobal('fetch', ...)` |
| **Run** | `pnpm --filter=@9nau/accounts test` |
| **Coverage** | `pnpm --filter=@9nau/accounts test:ci` |
| **CI** | `.github/workflows/ci-accounts.yml` |

**Key specs**:
- `src/app/__tests__/actions.test.ts` — loginAction, registerAction, logoutAction

**Notes on Next.js server action testing**: Server actions cannot be imported directly in a test environment because Next.js adds special transforms. The actions in `accounts` are plain `async function` exports with `'use server'` at the top — Vitest strips that directive via the `node` environment. Mock `next/headers` before importing the module.

### `apps/app` — Next.js 14 (main frontend)

| | |
|---|---|
| **Framework** | Vitest (replacing the declared-but-unconfigured Jest setup) |
| **Config** | `apps/app/vitest.config.ts` (to be created — see [Section 9](#9-adding-tests-for-a-new-app)) |
| **Run** | `pnpm --filter=@9nau/app test:ci` |
| **CI** | `.github/workflows/ci-app.yml` |

Existing spec files (8 files under `src/`) target components and hooks. The Jest config exists but the `test` script was not wired — the CI workflow now runs `test:ci`.

### `apps/flownau` — Next.js + Remotion

| | |
|---|---|
| **Framework** | Vitest |
| **Config** | `apps/flownau/vitest.config.ts` |
| **Environment** | `jsdom` |
| **Run** | `pnpm --filter=flownau test` |
| **Coverage** | `pnpm --filter=flownau test:ci` |
| **CI** | `.github/workflows/ci-flownau.yml` |

Remotion video rendering modules are excluded from coverage thresholds (they require a headless browser). Tests cover API routes, service logic, and utility functions.

### `apps/zazu-bot` — Express + Telegraf

| | |
|---|---|
| **Framework** | Vitest |
| **Config** | `apps/zazu-bot/vitest.config.ts` |
| **Environment** | `node` |
| **Run** | `pnpm --filter=@zazu/bot test` |
| **CI** | `.github/workflows/ci-zazu-bot.yml` |

**Key specs**:
- `src/__tests__/skill-manager.test.ts` — dispatch, priority sorting, feature gating, error fallthrough
- `src/__tests__/service-auth.test.ts` — Express middleware for inbound service tokens

### `apps/zazu-dashboard` — Next.js 15

| | |
|---|---|
| **Framework** | Vitest |
| **Config** | `apps/zazu-dashboard/vitest.config.ts` |
| **Environment** | `node` |
| **Run** | `pnpm --filter=@zazu/dashboard test` |
| **CI** | `.github/workflows/ci-zazu-dashboard.yml` |

**Key specs**:
- `app/lib/__tests__/telegram.test.ts` — HMAC-SHA256 init-data validation (real crypto, crafted signatures)
- `app/lib/__tests__/auth.test.ts` — session helpers built on top of Telegram validation

### `apps/mobile` — Expo / React Native

| | |
|---|---|
| **Framework** | Jest + `jest-expo` preset |
| **Config** | `jest` field in `apps/mobile/package.json` |
| **Environment** | `node` (via jest-expo's Node transformer) |
| **Run** | `pnpm --filter=mobile test` |
| **CI** | `.github/workflows/ci-mobile.yml` |

Expo SDK modules (expo-sqlite, expo-file-system, etc.) are auto-mocked by the `jest-expo` preset. Tests focus on pure business logic in services and repositories — not on UI components or native APIs.

**Key specs**:
- `src/services/__tests__/FrequencyService.test.ts` — spaced-repetition scheduling logic (pure functions)
- `src/repositories/__tests__/LabelRepository.test.ts` — SQLite CRUD with mocked `executeSql`/`runSql`

---

## 4. CI workflows

Every app has a dedicated GitHub Actions workflow under `.github/workflows/`. All workflows follow the same pattern:

```
1. Install dependencies (pnpm --frozen-lockfile)
2. Run tests with coverage  ← NEW: was missing before
3. Upload coverage artifact  ← NEW
4. Typecheck
5. Build
```

Build is gated on tests passing (`needs: test`) so a failing test never lets a broken build through.

### Workflow index

| File | App | Test command |
|------|-----|-------------|
| `ci-api.yml` | api | `pnpm --filter=api test:cov` |
| `ci-nauthenticity.yml` | nauthenticity | `pnpm --filter=nauthenticity test:ci` |
| `ci-accounts.yml` | accounts | `pnpm --filter=@9nau/accounts test:ci` |
| `ci-app.yml` | app | `pnpm --filter=@9nau/app test:ci` |
| `ci-flownau.yml` | flownau | `pnpm --filter=flownau test:ci` |
| `ci-zazu-bot.yml` | zazu-bot | `pnpm --filter=@zazu/bot test:ci` |
| `ci-zazu-dashboard.yml` | zazu-dashboard | `pnpm --filter=@zazu/dashboard test:ci` |
| `ci-mobile.yml` | mobile | `pnpm --filter=mobile test:ci` |
| `ci-packages.yml` | all packages | `pnpm --filter='./packages/*' run test` |
| `ci-e2e.yml` | all apps | `pnpm exec playwright test` |

Coverage reports are uploaded as GitHub Actions artifacts with a 7-day retention. Download them from the Actions tab of any workflow run.

---

## 5. E2E tests with Playwright

### Configuration

`playwright.config.ts` at the repo root defines four projects:

| Project | Tests | Auth |
|---------|-------|------|
| `auth-setup` | `tests/e2e/auth.setup.ts` | none — performs login |
| `accounts` | `tests/e2e/accounts/**/*.spec.ts` | none (unauthenticated flows) |
| `app` | `tests/e2e/app/**/*.spec.ts` | uses saved session from auth-setup |
| `zazu-dashboard` | `tests/e2e/zazu-dashboard/**/*.spec.ts` | Telegram-specific |

### Auth state management

Playwright's `storageState` feature is used to avoid re-logging in on every test:

1. `auth.setup.ts` performs a real browser login against the accounts app
2. It saves the session cookies to `tests/e2e/.auth/user.json`
3. Test projects that require auth load this file via `storageState`

`tests/e2e/.auth/user.json` is **gitignored** — it contains real session tokens. The `.auth/` directory exists in the repo with a `.gitkeep` file.

### Test structure

```
tests/e2e/
├── .auth/
│   ├── .gitkeep          ← ensures directory exists in git
│   └── user.json         ← GITIGNORED — real session cookies
├── auth.setup.ts         ← runs once, saves auth state
├── accounts/
│   ├── login.spec.ts     ← login form, error handling, network failure
│   └── register.spec.ts  ← registration form, taken email error
└── app/
    └── dashboard.spec.ts ← authenticated dashboard smoke tests, session expiry
```

### Running E2E locally

```bash
# Prerequisites: apps must be running
pnpm --filter=@9nau/accounts dev:on &
pnpm --filter=@9nau/app dev:on &

# Set credentials for auth setup
export E2E_USER_EMAIL=testuser@example.com
export E2E_USER_PASSWORD=TestPass123!

# Run all E2E tests
pnpm e2e

# Run with Playwright UI (interactive)
pnpm e2e:ui

# Run only one project
pnpm e2e --project=accounts
```

### Adding an E2E test

1. Create a `.spec.ts` file in the appropriate `tests/e2e/<app>/` directory
2. If the test requires authentication, the project in `playwright.config.ts` must declare `dependencies: ['auth-setup']` and `storageState: 'tests/e2e/.auth/user.json'`
3. Use `page.route()` to mock external API calls where the real API is unavailable or would have side effects (e.g., sending emails)
4. Prefer `getByRole` and `getByLabel` locators over CSS selectors for resilience

---

## 6. Security test strategy

Security tests are split across two layers:

### Layer A: Unit security tests

Located in `__tests__/security.spec.ts` files within each app. These test:
- Auth guards reject missing, malformed, expired tokens
- Token types cannot be cross-used (user token ≠ service token)
- Error messages do not leak internals (secrets, user existence, stack traces)

### Layer B: E2E security tests

Located in `tests/e2e/`. These test:
- Login form shows generic errors without revealing whether an account exists
- Session cookies are cleared on logout
- Protected routes redirect to login when session expires (cookie cleared)

### Security checklist for new endpoints

When adding a new API endpoint or Next.js route, add tests that verify:

- [ ] The endpoint returns 401 with no auth token
- [ ] The endpoint returns 401 with a token for the wrong service
- [ ] The endpoint returns 403 (not 404) when the resource exists but the caller doesn't own it
- [ ] Error responses do not contain stack traces
- [ ] Cookie-based responses set `HttpOnly`, `Secure`, `SameSite` flags

---

## 7. Running tests locally

### Run all unit tests for one app

```bash
# api (Jest)
pnpm --filter=api test

# nauthenticity (Jest)
pnpm --filter=nauthenticity test

# accounts (Vitest)
pnpm --filter=@9nau/accounts test

# flownau (Vitest)
pnpm --filter=flownau test

# zazu-bot (Vitest)
pnpm --filter=@zazu/bot test

# zazu-dashboard (Vitest)
pnpm --filter=@zazu/dashboard test

# mobile (Jest + jest-expo)
pnpm --filter=mobile test
```

### Run with coverage

Replace `test` with `test:cov` (Jest apps) or `test:ci` (Vitest apps).

### Watch mode

```bash
# Jest apps
pnpm --filter=api test:watch

# Vitest apps (watch is the default when not passing --run)
pnpm --filter=flownau test
```

### Run a specific test file

```bash
# Jest
pnpm --filter=api test -- src/blocks/blocks.service.spec.ts

# Vitest
pnpm --filter=flownau test -- src/modules/ideation
```

---

## 8. Adding tests for a new feature

### NestJS apps (api, nauthenticity)

1. Create `src/<module>/__tests__/<name>.spec.ts`
2. Import the class under test directly (not via the NestJS module factory unless you need DI)
3. Mock `PrismaService` with `mock<PrismaService>()` from `jest-mock-extended`
4. Mock external HTTP with `jest.fn()` assigned to `global.fetch`
5. For security-relevant features, add a case to `src/common/guards/security.spec.ts` or the relevant `security.spec.ts`

```ts
import { mock, MockProxy } from 'jest-mock-extended'
import { MyService } from '../my.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('MyService', () => {
  let service: MyService
  let prisma: MockProxy<PrismaService>

  beforeEach(() => {
    prisma = mock<PrismaService>()
    service = new MyService(prisma)
  })

  it('...', async () => { ... })
})
```

### Next.js apps (accounts, app, flownau, zazu-dashboard)

1. Create `src/**/__tests__/<name>.test.ts`
2. Mock Next.js server APIs at the top of the file: `vi.mock('next/headers', ...)`, `vi.mock('next/navigation', ...)`
3. Mock fetch: `global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })`
4. Import the module under test AFTER mocks are set up

### React components

Use `@testing-library/react` + `render()`. For Next.js App Router components, wrap in a `<QueryClientProvider>` if they use React Query.

---

## 9. Adding tests for a new app

When a new app is added to `apps/`:

1. **Choose the test framework** based on the tech stack (see [Section 1](#1-architecture-overview))
2. **Add test scripts** to the app's `package.json`:
   - Jest apps: `"test": "jest"`, `"test:cov": "jest --coverage"`, `"test:ci": "jest --coverage --ci --forceExit"`
   - Vitest apps: `"test": "vitest"`, `"test:ci": "vitest --run --coverage"`
3. **Create a config file**:
   - Jest: `jest.config.js` (see `apps/api/jest.config.js` as template)
   - Vitest: `vitest.config.ts` (see `apps/zazu-bot/vitest.config.ts` as template)
4. **Install test dependencies** in the app's `package.json` devDependencies
5. **Create a CI workflow** in `.github/workflows/ci-<app-name>.yml` (copy any existing one and change the filter name)
6. **Write at least one test** before the PR merges — an empty test suite is not acceptable
7. **Add an E2E project** to `playwright.config.ts` if the app has a user-facing interface

---

## 10. Environment variables

Unit tests should **not** require real credentials. Use dummy values or let the config have defaults.

For CI workflows, the minimum env vars needed per app are:

| App | Required CI env vars |
|-----|---------------------|
| api | `NODE_ENV=test`, `AUTH_SECRET` |
| nauthenticity | `NODE_ENV=test`, `AUTH_SECRET`, `DATABASE_URL` (dummy), `APIFY_TOKEN` (dummy), `OPENAI_API_KEY` (dummy) |
| accounts | `NODE_ENV=test` |
| flownau | `NODE_ENV=test`, `DATABASE_URL` (dummy), `AUTH_SECRET` |
| zazu-bot | `NODE_ENV=test`, `AUTH_SECRET`, `TELEGRAM_BOT_TOKEN` |
| zazu-dashboard | `NODE_ENV=test`, `TELEGRAM_BOT_TOKEN` |
| mobile | `NODE_ENV=test` |

For E2E tests, real credentials are needed:

| Var | Purpose |
|-----|---------|
| `E2E_USER_EMAIL` | Email of a pre-seeded test user |
| `E2E_USER_PASSWORD` | Password for that user |
| `AUTH_SECRET` | Must match the running api service |
| `DATABASE_URL` | Postgres URL for the E2E test database |

Set these as GitHub Actions secrets (not env vars, so they are not visible in logs).

---

## 11. Coverage policy

Coverage is collected and uploaded as an artifact on every CI run. There are no hard coverage gates enforced in CI today — the policy is:

- **New features must include tests.** PRs that add significant logic without tests will be flagged in review.
- **Coverage must not decrease** from the baseline on `main`. Use the artifact comparison to verify.
- **Security-critical paths** (auth guards, token validation, cookie handling) must have 100% line coverage.

To set up a coverage gate, add a `coverageThreshold` to the Jest/Vitest config. Example for nauthenticity:

```js
// jest.config.js
coverageThreshold: {
  './src/nest/auth/**': {
    lines: 100,
    branches: 100,
  },
  global: {
    lines: 60,
  },
}
```

---

## 12. Known gaps and future work

| Gap | Priority | Notes |
|-----|----------|-------|
| `app` — vitest.config.ts not yet created | High | The CI workflow references `test:ci` but the config file and scripts need to be added to `apps/app/package.json` |
| `whatsnau/frontend` — zero tests | Medium | Next.js app with no test setup; follow the accounts pattern |
| `api` — no test for JWT-based auth (uses a custom implementation) | Medium | Add tests for the JWT guard once JwtAuthGuard is implemented in api |
| E2E — no zazu-dashboard specs | Medium | Telegram Web App requires `x-telegram-init-data` header; Playwright can set custom headers to simulate this |
| Coverage gate | Low | Add `coverageThreshold` to each Jest/Vitest config once baseline is established |
| `msw` (Mock Service Worker) | Low | Consider replacing `vi.stubGlobal('fetch', ...)` with msw for more realistic API mocking in Next.js component tests |
| React Native component tests | Low | `@testing-library/react-native` would allow testing UI components; currently only business logic is tested in mobile |
