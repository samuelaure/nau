# naŭ Platform — Claude Instructions

> Project-scoped instructions for working with this codebase. Read automatically by Claude Code at the start of every session.
> Canonical documentation lives in `docs/`. When in doubt, defer to the docs.

---

## What this project is

naŭ Platform is a multi-tenant SaaS monorepo for creators managing a fleet of brands across social platforms. It automates ideation, content creation, rendering, publishing, competitor monitoring, and audience engagement — all running 24/7 with background workers.

Monorepo at `c:\Users\Sam\code\nau`. Services under `apps/`, shared packages under `packages/`.

---

## Architecture rules — never violate these

1. **Identity is owned by `api` only.** `User`, `Workspace`, `Brand`, `SocialProfile`, `Prompt` live in `apps/api`. No other service duplicates these tables.
2. **Cross-service data via API, never direct DB.** If `flownau` needs brand data, it calls `api.9nau.com` via `@nau/sdk`. No cross-database joins.
3. **One prompt table for all prompts.** `Prompt.ownerType + Prompt.type` covers every use case. No per-feature prompt tables.
4. **Per-service databases.** Each service has its own Postgres. Never write a migration that touches another service's DB.
5. **Service-to-service auth is signed service JWTs.** No shared secrets, no `x-nau-service-key` header (deprecated).

Full architecture: `docs/platform/ARCHITECTURE.md`

---

## Naming — always use the canonical names

| Concept | Use | Never use |
|---|---|---|
| Social platform presence | `SocialProfile` | `SocialAccount`, `IgProfile`, `Profile` |
| Brand entity | `Brand` | `BrandIntelligence`, `Company`, `Project` |
| LLM prompt text | `Prompt` | `SystemPrompt`, `BrandPersona`, `IdeasFramework` |
| Collaboration group | `Workspace` | `Organization`, `Team`, `Tenant` |
| User-brand link table | `WorkspaceMember` | `Membership`, `UserWorkspace` |

Foreign keys: bare unprefixed — `brandId`, `workspaceId`, `socialProfileId`. Never `nauBrandId` or `platformWorkspaceId`.

Full naming canon: `docs/platform/NAMING.md`

---

## Background processes — treat with care

The platform runs 24/7 background workers. Before touching any of these services, check whether jobs are active.

| Service | Background processes |
|---|---|
| `flownau` | Remotion renders, post scheduler cron (every 5 min), internal cron |
| `nauthenticity` | BullMQ: ingestion, download, optimization, compute workers |
| `api` | Scheduled jobs, inter-service webhooks |

**Never restart a worker service while jobs are active unless it is a deliberate, acknowledged tradeoff.** Nauthenticity has startup recovery (`WorkersService.recoverStuckRuns`) that re-enqueues stuck runs — but it cannot recover jobs that were mid-execution.

Check queue status before touching nauthenticity:
```bash
ssh nau "docker exec nauthenticity curl -s http://localhost:3000/queue | jq '{download:.download.counts, optimization:.optimization.counts, compute:.compute.counts}'"
```

Full deployment protocol: `docs/platform/DEPLOYMENT.md` → "Production Deployment Protocol"

---

## Queue changes — checklist

When adding or modifying a BullMQ queue in nauthenticity:
- Register it in `AnalyticsService.getQueueStatus()` (`analytics.service.ts`)
- Register `retry/clear/delete` in `AnalyticsService`
- Register worker in `WorkersService.workers` array
- If it introduces a new transitional run phase, handle it in `WorkersService.recoverStuckRuns()`

---

## Schema changes — protocol

- **Additive only** (ADD COLUMN, CREATE TABLE, CREATE INDEX) can deploy without a window.
- **Destructive** (DROP, ALTER TYPE, RENAME) require: old+new schema tolerant code first → migration → cleanup deploy.
- Run `pnpm --filter <service> build` before committing schema changes to catch TypeScript breakage.

---

## Code style

- **No comments** unless the WHY is non-obvious (hidden constraint, subtle invariant, known bug workaround). No "used by X", no "added for Y flow".
- **No error handling for impossible cases.** Only validate at system boundaries (user input, external APIs).
- **No premature abstractions.** Three similar lines is fine. Abstract only when there are four+ repetitions with identical shape.
- **No backwards-compat shims.** If something is unused, delete it.
- **Structured logs only.** No `console.log` in production paths. Use `@nau/logger` (pino).
- TypeScript strictly — no untyped `any` in queue/worker/schema code.

---

## File structure conventions

- NestJS services: `<resource>.controller.ts`, `<domain>.service.ts`, `<domain>.schema.ts`
- Next.js App Router: `route.ts`, `page.tsx`, `layout.tsx`
- React components: PascalCase filename = PascalCase export (`BrandSwitcher.tsx` → `BrandSwitcher`)
- Tests: `.spec.ts` (prefer) or `.test.ts` — one convention per app

---

## Services quick reference

| Service | Dir | Stack | Domain |
|---|---|---|---|
| 9naŭ API | `apps/api` | NestJS, Postgres | Identity control plane |
| accounts | `apps/accounts` | Next.js 15 | SSO UI |
| app | `apps/app` | Next.js 15 | Second Brain UI |
| flownau | `apps/flownau` | Next.js 15, BullMQ, Remotion | Content creation engine |
| nauthenticity | `apps/nauthenticity` | NestJS, Postgres+pgvector, BullMQ | Brand intelligence |
| zazu-bot | `apps/zazu-bot` | Telegraf | Telegram bot |
| zazu-dashboard | `apps/zazu-dashboard` | Next.js 15 | Telegram Mini App |
| whatsnau | `apps/whatsnau` | Node.js | WhatsApp CRM (deferred) |

---

## Key paths

| What | Where |
|---|---|
| Platform docs | `docs/platform/` |
| Deployment protocol | `docs/platform/DEPLOYMENT.md` |
| Naming canon | `docs/platform/NAMING.md` |
| Architecture | `docs/platform/ARCHITECTURE.md` |
| ADRs | `docs/decisions/` |
| nauthenticity workers | `apps/nauthenticity/src/queues/` |
| nauthenticity worker registry | `apps/nauthenticity/src/nest/workers/workers.service.ts` |
| flownau cron | `apps/flownau/src/modules/scheduling/internal-cron.ts` |
| flownau Remotion templates | `apps/flownau/src/modules/video/remotion/ReelTemplates.tsx` |

---

## Deployment

- Push to `main` triggers all CI/CD workflows automatically (GitHub Actions → GHCR → Hetzner VPS).
- **Always check queues before pushing** if the change touches nauthenticity or flownau workers.
- Preferred window for worker-touching deploys: 03:00–06:00 UTC.
- Rollback: each push produces a `sha-<git-sha>` tag in GHCR — pin it in `.env` and `docker compose up -d`.

Server: `ssh nau` → `~/apps/<service>/`
Logs: `ssh nau "docker logs <container> --tail=50 -f"`
