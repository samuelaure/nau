# Whatsnau Refactoring Plan

Whatsnau was an independent monorepo (npm workspaces + Turbo) merged into nau-platform.
This document tracks the integration work needed to bring it to platform standards.

## Status: Deferred — not a current priority

---

## Phase 1 — Package Manager Migration (prerequisite for everything else)

**Goal:** Replace npm with pnpm so whatsnau participates fully in the root workspace.

- [ ] Remove `"packageManager": "npm@10.9.4"` from `apps/whatsnau/package.json`
- [ ] Delete `apps/whatsnau/package-lock.json` and `apps/whatsnau/packages/frontend/package-lock.json`
- [ ] Add `apps/whatsnau/packages/*` to root `pnpm-workspace.yaml`
- [ ] Remove the sub-monorepo turbo workaround in `apps/whatsnau/package.json` dev script
- [ ] Run `pnpm install` from repo root and verify all packages resolve
- [ ] Update all `npm run` calls in whatsnau scripts to `pnpm`

---

## Phase 2 — Adopt Platform Shared Packages

**Goal:** Replace custom re-implementations with shared platform packages.

### Auth — replace `jsonwebtoken` + custom middleware
- [ ] Replace `src/core/authMiddleware.ts` with `@nau/auth` `verifyAccessToken`
- [ ] Remove `jsonwebtoken` and `bcryptjs` (keep bcrypt for password hashing only)
- [ ] Align token format with platform (jose-based, `COOKIE_ACCESS_TOKEN` cookie)

### Logger — replace local pino setup
- [ ] Remove `src/core/logger.ts`
- [ ] Replace all `logger` imports with `createLogger` from `@nau/logger`
- [ ] Use `createLogger({ service: 'whatsnau-api' })`

### Config — replace local Zod schema
- [ ] Remove `src/core/config.ts`
- [ ] Replace with `createConfig` from `@nau/config`
- [ ] Map env var names to platform conventions (e.g. `REDIS_HOST/PORT/PASSWORD` → `REDIS_URL`)

---

## Phase 3 — Express → NestJS Migration

**Decision made:** Migrate to NestJS to match `api` and `nauthenticity` backends.

### New module structure
```
src/
├── main.ts
├── app.module.ts
├── prisma/           PrismaService (extends PrismaClient, onModuleInit)
├── config/           ConfigModule using @nau/config createConfig
├── common/
│   ├── filters/      GlobalExceptionFilter (replaces errorMiddleware)
│   ├── guards/       AuthGuard (replaces authMiddleware, uses @nau/auth)
│   └── decorators/   @CurrentUser(), @TenantId()
├── auth/             AuthModule — login, logout, /me
├── campaigns/        CampaignModule — CRUD
├── leads/            LeadsModule — list, messages, ai-toggle, handover
├── whatsapp/         WhatsAppModule — onboarding, webhook (GET+POST), providers
├── import/           ImportModule — CSV, batches, cleanse, verify, execute
├── admin/            AdminModule — health, alerts, retry, metrics
├── dashboard/        DashboardModule — stats, SSE events, config routes
├── config-mgmt/      ConfigMgmtModule — global, business, prompts, sequences, keywords, templates, telegram, openai
├── queues/           QueuesModule — BullMQ: inbound, outbound, maintenance processors
├── orchestration/    OrchestrationModule — Orchestrator, MessageRouter, AgentCoordinator, StateTransitionEngine, ComplianceGateway
└── services/         Standalone services: AI, Sequence, Notification, Events, Buffer, Template, Metrics, Campaign seed
```

### Key migration notes

**Workers (BullMQ → @nestjs/bullmq)**
- `inbound.worker.ts` → `InboundProcessor` with `@Processor('inbound-webhooks')` + `@Process('inbound-event')`
- `outbound.worker.ts` → `OutboundProcessor` with `@Processor('outbound-messages')` + `@Process('send-message')`
- `maintenance.worker.ts` → `MaintenanceProcessor` with `@Processor('maintenance-tasks')` + `@Process('lead-recovery')`

**Scheduled tasks (`setInterval` → `@Cron`)**
- `sequence.service.ts` `processFollowUps()` runs every 5 min → `@Cron('*/5 * * * *')`
- `maintenance.queue.ts` `initRepeatableJobs()` → `@Cron` decorator

**Graceful shutdown**
- Replace `GracefulShutdown` static class with NestJS lifecycle hooks `onModuleDestroy()`
- Call `app.enableShutdownHooks()` in `main.ts`

**Correlation ID**
- Replace manual context tracking in `CorrelationId.ts` with `nestjs-cls` `ClsService`

**SSE**
- Replace manual `res.write()` + `EventsService` stream map with `@Sse()` decorator

**CircuitBreaker / ErrorBoundary / withRetry**
- Keep as utility files (not injectable), import directly into services
- Or extract to `ResilienceService` for testability

**Multi-tenant auth flow**
- Webhook controller remains PUBLIC (no AuthGuard), does signature verification inline
- All dashboard/admin/import/campaigns routes get `@UseGuards(AuthGuard)`
- `tenantId` extracted from JWT, injected via `@CurrentTenantId()` decorator

### Prisma
- Already upgraded to ^7.8.0 in package.json
- Run `prisma generate` after install

---

## Phase 4 — Frontend Evaluation

Current: Vite SPA (`@whatsnau/frontend`)
Options:
1. **Keep Vite SPA** — works, but can't use `@9nau/ui` (React 18 peer dep mismatch) or next-auth
2. **Migrate to Next.js** — aligns with all other frontends, enables @9nau/ui, server components, route handlers

**Recommendation:** Migrate to Next.js 15 under `apps/whatsnau-dashboard/`, keeping the
`@xyflow/react` flow diagram component (works in both). Use `@9nau/ui` for all new UI.

---

## Phase 5 — Prisma Schema Alignment

- [ ] Review schema for naming convention consistency with other schemas (camelCase models, etc.)
- [ ] Consider whether `Tenant` model should federate with the platform's tenant concept in `api`
- [ ] Evaluate extracting shared models to a `@nau/db` package (long-term)

---

## Dependencies to add after Phase 1

```json
{
  "@nau/auth": "workspace:*",
  "@nau/logger": "workspace:*",
  "@nau/config": "workspace:*",
  "@nestjs/common": "^10",
  "@nestjs/core": "^10",
  "@nestjs/platform-express": "^10",
  "@nestjs/config": "^3",
  "@nestjs/bull": "^10",
  "@nestjs/schedule": "^4",
  "@nestjs/terminus": "^10",
  "nestjs-cls": "^4"
}
```

## Dependencies to remove after Phase 3

```
express, body-parser, cors, helmet, express-rate-limit,
cookie-parser (express version), jsonwebtoken, asyncHandler pattern
```
