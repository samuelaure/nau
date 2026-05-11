# Sentry Integration Plan — naŭ Platform

## 1. Project / DSN Structure

Use **one Sentry organization, one project per service**. A single project for everything collapses alerting granularity and makes per-service release tracking impossible.

| Service | Sentry project slug | DSN env var |
|---|---|---|
| `apps/api` | `nau-api` | `SENTRY_DSN` |
| `apps/nauthenticity` | `nau-nauthenticity` | `SENTRY_DSN` |
| `apps/flownau` | `nau-flownau` | `SENTRY_DSN` |
| `apps/accounts` | `nau-accounts` | `SENTRY_DSN` |
| `apps/app` | `nau-app` | `SENTRY_DSN` |
| `apps/nauthenticity/dashboard` | `nau-nauthenticity-dashboard` | `VITE_SENTRY_DSN` |

Each project gets its own DSN. The env var is always `SENTRY_DSN` (or `VITE_SENTRY_DSN` for Vite) — identical names per service keep the Docker Compose and CI env files consistent. Values differ per container.

---

## 2. Priority Order

1. **nauthenticity** — four BullMQ workers running 24/7 with no error monitoring. A silently failing `compute` or `ingestion` job can corrupt a scraping run with no signal.
2. **flownau** — cron-driven publisher and renderer at `apps/flownau/src/modules/scheduling/internal-cron.ts`; publish failures already log to pino but produce no alert.
3. **api** — lowest risk per-request (stateless), but captures auth/identity bugs.
4. **accounts / app / nauthenticity dashboard** — client surfaces; less critical than workers.

---

## 3. Packages to Install

Run from the monorepo root with `pnpm --filter <name>`.

| Service | Package filter | Packages |
|---|---|---|
| `apps/api` | `@9nau/api` | `@sentry/nestjs@8` `@sentry/profiling-node@8` |
| `apps/nauthenticity` | `nauthenticity` | `@sentry/nestjs@8` `@sentry/profiling-node@8` |
| `apps/flownau` | `flownau` | `@sentry/nextjs@8` |
| `apps/accounts` | `@9nau/accounts` | `@sentry/nextjs@8` |
| `apps/app` | `@9nau/app` | `@sentry/nextjs@8` |
| `apps/nauthenticity/dashboard` | `@nauthenticity/dashboard` | `@sentry/react@8` |

Pin to `8.x` — the current stable major. Do not mix `7.x` and `8.x` across packages.

```bash
pnpm --filter @9nau/api add @sentry/nestjs@8 @sentry/profiling-node@8
pnpm --filter nauthenticity add @sentry/nestjs@8 @sentry/profiling-node@8
pnpm --filter flownau add @sentry/nextjs@8
pnpm --filter @9nau/accounts add @sentry/nextjs@8
pnpm --filter @9nau/app add @sentry/nextjs@8
pnpm --filter @nauthenticity/dashboard add @sentry/react@8
```

---

## 4. `apps/api` — NestJS Setup

### 4.1 `apps/api/src/instrument.ts` (new file, import before anything else)

```ts
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.SENTRY_RELEASE,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
});
```

### 4.2 `apps/api/src/main.ts` — import instrument first

Add as the very first import line, before NestJS imports:

```ts
import './instrument';
```

### 4.3 `apps/api/src/app.module.ts` — add SentryModule

```ts
import { SentryModule } from '@sentry/nestjs/setup';

@Module({
  imports: [
    SentryModule.forRoot(),
    // ...existing modules
  ],
})
```

### 4.4 `apps/api/src/common/filters/all-exceptions.filter.ts` — capture 5xx only

The existing filter already distinguishes `HttpException` from unknown errors. Add Sentry capture only for non-4xx:

```ts
import * as Sentry from '@sentry/nestjs';

// Inside the catch() method, after computing httpStatus:
if (httpStatus >= 500) {
  Sentry.captureException(exception);
}
```

4xx errors (validation failures, not-found, conflicts) are user errors — do not send them to Sentry. The existing `Prisma.PrismaClientKnownRequestError` branch covers P2002/P2025 which resolve to 409/404 — these should also be excluded.

---

## 5. `apps/nauthenticity` — NestJS + BullMQ Setup

### 5.1 `apps/nauthenticity/src/instrument.ts` (new file)

```ts
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.SENTRY_RELEASE,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
});
```

### 5.2 `apps/nauthenticity/src/main.ts` — import instrument first

```ts
import './instrument';
```

Add before all other imports. The existing `bootstrap()` function and express SPA fallback remain unchanged.

### 5.3 `apps/nauthenticity/src/nest/app.module.ts` — SentryModule

```ts
import { SentryModule } from '@sentry/nestjs/setup';

imports: [SentryModule.forRoot(), ...]
```

### 5.4 `apps/nauthenticity/src/nest/common/filters/all-exceptions.filter.ts`

Same 5xx-only pattern as api. Nauthenticity's filter is structurally identical.

### 5.5 BullMQ worker `failed` event listeners

Each worker already has a `failed` listener that logs to pino. Extend all four workers to also capture to Sentry with job context attached to the scope.

Pattern to apply to `apps/nauthenticity/src/queues/ingestion.worker.ts`, `download.worker.ts`, `optimization.worker.ts`, and `compute.worker.ts`:

```ts
import * as Sentry from '@sentry/node';

ingestionWorker.on('failed', (job, err) => {
  logger.error(`[IngestionWorker] Job ${job?.id} failed: ${err.message}`);
  Sentry.withScope((scope) => {
    scope.setTag('worker', 'ingestion');
    scope.setContext('job', {
      jobId: job?.id,
      jobName: job?.name,
      username: job?.data?.username,
      attempt: job?.attemptsMade,
    });
    Sentry.captureException(err);
  });
});
```

For `download.worker.ts` and `optimization.worker.ts`, attach `mediaId` and `runId` from `job.data` to the context. For `compute.worker.ts`, attach `runId` and `username`. These fields are already present in each worker's `JobData` interface.

### 5.6 Attaching brandId context in workers

`ingestion.worker.ts` uses `logContextStorage` (AsyncLocalStorage) that already holds `{ jobId, username }`. Extend scope with `brandId` where available — specifically in the `compute.worker.ts` job data which carries `runId`; a DB lookup can enrich it, but keep it optional to avoid blocking the error path.

---

## 6. `apps/flownau` — Next.js 15 Setup

### 6.1 Wizard-generated config files (create manually, not via wizard)

**`apps/flownau/sentry.server.config.ts`**:

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: !!process.env.SENTRY_DSN,
});
```

**`apps/flownau/sentry.client.config.ts`**:

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
```

**`apps/flownau/sentry.edge.config.ts`**:

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.05,
  enabled: !!process.env.SENTRY_DSN,
});
```

### 6.2 `apps/flownau/src/instrumentation.ts` — extend existing file

The existing `instrumentation.ts` starts the internal cron and recovers stuck assets. Add Sentry initialization at the top of the `nodejs` block:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { init } = await import('@sentry/nextjs');
    init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      release: process.env.SENTRY_RELEASE,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      enabled: !!process.env.SENTRY_DSN,
    });

    const { startInternalCron } = await import('@/modules/scheduling/internal-cron');
    startInternalCron();
    // ...rest unchanged
  }
}
```

### 6.3 `apps/flownau/next.config.ts` — wrap with Sentry

```ts
import { withSentryConfig } from '@sentry/nextjs';

// ...existing nextConfig object unchanged...

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: 'nau-flownau',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
```

### 6.4 Capturing publish failures in the cron

`apps/flownau/src/modules/scheduling/internal-cron.ts` already has a `catch` block in `runPublisher()` that calls `logError()`. Add Sentry capture with post context:

```ts
import * as Sentry from '@sentry/nextjs';

// Inside the catch block in runPublisher():
Sentry.withScope((scope) => {
  scope.setTag('cron', 'publisher');
  scope.setContext('post', {
    postId: post.id,
    brandId: post.brandId,
    format: post.format,
    attempts: post.publishAttempts + 1,
  });
  Sentry.captureException(err);
});
```

---

## 7. `apps/nauthenticity/dashboard` — Vite React Setup

### 7.1 `apps/nauthenticity/dashboard/src/main.tsx`

```tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
});
```

Add before `ReactDOM.createRoot(...)`.

### 7.2 `apps/nauthenticity/dashboard/src/App.tsx` — ErrorBoundary

```tsx
import * as Sentry from '@sentry/react';

export default Sentry.withErrorBoundary(App, {
  fallback: <div>Something went wrong. Reload the page.</div>,
});
```

### 7.3 User context

When the user authenticates (wherever JWT is decoded or the `/auth/callback` route resolves), call:

```ts
Sentry.setUser({ id: workspaceId, username: brandId });
```

Clear on logout: `Sentry.setUser(null)`.

### 7.4 `apps/nauthenticity/dashboard/vite.config.ts` — source maps

```ts
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: 'nau-nauthenticity-dashboard',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: { sourcemap: true },
  // ...existing server proxy config unchanged
});
```

---

## 8. Environment Variables

### 8.1 Add to each service's `.env.example`

**`apps/api/.env.example`**, **`apps/nauthenticity/.env.example`**:
```
SENTRY_DSN=
SENTRY_RELEASE=
SENTRY_ORG=
SENTRY_AUTH_TOKEN=
```

**`apps/flownau/.env.example`**:
```
SENTRY_DSN=
SENTRY_RELEASE=
SENTRY_ORG=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_RELEASE=
```

**`apps/accounts/.env.example`**, **`apps/app/.env.example`**:
```
SENTRY_DSN=
SENTRY_RELEASE=
SENTRY_ORG=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_RELEASE=
```

**`apps/nauthenticity/dashboard/.env.example`**:
```
VITE_SENTRY_DSN=
VITE_SENTRY_RELEASE=
```

### 8.2 `.env.development` values

Set `SENTRY_DSN=` (empty) in all development env files. This disables Sentry locally because `enabled: !!process.env.SENTRY_DSN` evaluates to false.

### 8.3 Production — injected via GitHub Secrets

Add the following GitHub Actions secrets:

| Secret name | Used by |
|---|---|
| `SENTRY_AUTH_TOKEN` | All CI workflows (source map upload) |
| `SENTRY_ORG` | All CI workflows |
| `API_SENTRY_DSN` | Injected into `API_ENV_FILE` |
| `NAUTHENTICITY_SENTRY_DSN` | Injected into `NAUTHENTICITY_ENV_FILE` |
| `FLOWNAU_SENTRY_DSN` | Injected into `FLOWNAU_ENV_FILE` |
| `ACCOUNTS_SENTRY_DSN` | Injected into `ACCOUNTS_ENV_FILE` |
| `APP_SENTRY_DSN` | Injected into `APP_ENV_FILE` |
| `NAUTHENTICITY_DASHBOARD_SENTRY_DSN` | Injected into `NAUTHENTICITY_ENV_FILE` for Vite build |

The existing pattern (e.g. `echo "${{ secrets.FLOWNAU_ENV_FILE }}" > ~/apps/flownau/.env`) already writes a full env file to the server. Add the DSN to each service's env file secret in GitHub.

`SENTRY_RELEASE` should be set to `${{ github.sha }}` in CI — see section 9.

---

## 9. Source Maps — GitHub Actions Steps

### 9.1 Pattern for NestJS services (`ci-api.yml`, `ci-nauthenticity.yml`)

Add a build step after the existing typecheck/build step, inside the `publish` job:

```yaml
- name: Upload source maps to Sentry
  run: |
    npx @sentry/cli@2 releases new ${{ github.sha }}
    npx @sentry/cli@2 releases files ${{ github.sha }} upload-sourcemaps ./dist \
      --rewrite \
      --url-prefix '~/'
    npx @sentry/cli@2 releases finalize ${{ github.sha }}
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: nau-api   # nau-nauthenticity for nauthenticity
```

Also pass `SENTRY_RELEASE: ${{ github.sha }}` into the Docker build args or env file so the running container reports the same release.

### 9.2 Next.js services (`ci-flownau.yml`, `ci-accounts.yml`, `ci-app.yml`)

`withSentryConfig` in `next.config.ts` handles source map upload automatically during `next build` when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and the project name are present. Add to the `build` job's env block:

```yaml
env:
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
  SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
  SENTRY_RELEASE: ${{ github.sha }}
```

For flownau the build job already runs `pnpm turbo build --filter=flownau`. The Sentry webpack plugin runs inside that build.

### 9.3 Vite dashboard (`ci-nauthenticity.yml`)

The `sentryVitePlugin` in `vite.config.ts` uploads source maps during `vite build`. Add the same three env vars to the dashboard build step in `ci-nauthenticity.yml`:

```yaml
- name: Build dashboard
  run: pnpm --filter @nauthenticity/dashboard build
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    VITE_SENTRY_RELEASE: ${{ github.sha }}
```

---

## 10. Alerting Rules

Configure in Sentry under each project → Alerts → Create Alert Rule.

### High severity — page immediately

| Rule | Condition | Project |
|---|---|---|
| BullMQ worker repeated failure | Issue seen > 3 times in 5 min, tag `worker` is set | `nau-nauthenticity` |
| Publish failure spike | Issue `[Cron:Publisher]` seen > 5 times in 10 min | `nau-flownau` |
| Apify error | Error message contains `apify` OR `Apify` in last 5 min | `nau-nauthenticity` |
| Sentry event rate spike | > 50 events in 1 min on any project | all projects |

### Medium severity — Slack notification

| Rule | Condition |
|---|---|
| New unhandled exception (first seen) | Any new issue in `nau-api` or `nau-nauthenticity` |
| Render timeout | Issue contains `RENDER_TIMEOUT` in `nau-flownau` |
| Token refresh failure | Issue contains `refreshTokenIfNeeded` |

### Configuration notes

- Connect Sentry to the team Slack workspace. Use a `#nau-alerts-critical` channel for high-severity and `#nau-alerts-info` for medium.
- For BullMQ workers, the `worker` tag set in the `withScope` callback (section 5.5) enables tag-based alert filtering per worker type (`ingestion`, `download`, `optimization`, `compute`).
- Enable **Issue Owners** in each project and map `apps/nauthenticity/src/queues/*` to the owner responsible for background jobs.

---

## 11. Implementation Checklist

Ordered by priority:

- [ ] Create six Sentry projects in the organization
- [ ] Add GitHub Secrets (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, per-service DSNs)
- [ ] `apps/nauthenticity`: add `instrument.ts`, import in `main.ts`, add SentryModule, extend all four worker `failed` listeners with `Sentry.withScope`
- [ ] `apps/flownau`: extend `instrumentation.ts`, add three sentry config files, wrap `next.config.ts`, add Sentry capture in `runPublisher()` catch block
- [ ] `apps/api`: add `instrument.ts`, import in `main.ts`, add SentryModule, add 5xx check in `all-exceptions.filter.ts`
- [ ] `apps/nauthenticity/dashboard`: init in `main.tsx`, wrap `App.tsx` with ErrorBoundary, update `vite.config.ts`
- [ ] `apps/accounts` and `apps/app`: add sentry config files, wrap `next.config.ts`
- [ ] Update all `.env.example` files
- [ ] Add source map upload steps to CI workflows
- [ ] Configure alert rules in Sentry UI
- [ ] Verify in staging: trigger a test exception, confirm event appears in Sentry with correct release and source-mapped stack trace
