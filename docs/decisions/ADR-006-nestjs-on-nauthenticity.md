# ADR-006 — Migrate nauthenticity from Fastify to NestJS

- **Status:** 🟢 Accepted
- **Date:** 2026-04-23

## Context

Nauthenticity is the brand intelligence service (scraping, transcription, embeddings, inspo, comment suggestions). It was built on Fastify early in the platform's life when lean overhead was the priority.

9naŭ API is built on NestJS — a structured, opinionated framework with modules, DI, guards, interceptors, and validation pipes out of the box.

The platform now has:
- Two backend frameworks to learn and maintain (Fastify in nauthenticity, NestJS in 9naŭ API).
- Divergent patterns for common needs: auth guards (NestJS `@UseGuards`) vs Fastify hooks; validation (NestJS `class-validator` / `ValidationPipe`) vs ad-hoc zod parsing; module organization vs flat controller registration.
- Friction for developers jumping between services.

## Decision

**Migrate nauthenticity from Fastify to NestJS.** All backend services in the platform become NestJS (except where a different framework is structurally required, like Next.js for full-stack apps with UI).

### Target stack (nauthenticity, post-migration)

- **NestJS** (backend framework)
- **`@nestjs/bullmq`** (queue workers — replaces raw BullMQ usage)
- **Prisma** (ORM — unchanged)
- **pgvector** (vector search — unchanged)
- **Apify** client (unchanged)
- Shared packages consumed: `@nau/auth`, `@nau/config`, `@nau/logger`, `@nau/sdk`, `@nau/storage`

### Scope of the migration

- 9 Fastify controllers → NestJS controllers + modules
- 4 BullMQ workers → `@nestjs/bullmq` processors
- Fastify plugins (CORS, rate-limit, static) → NestJS equivalents
- Auth middleware → `@nau/auth` guards (shared with 9naŭ API)
- Error handler → NestJS exception filter

Dashboard (React SPA) is unaffected — continues to be served via static file middleware.

## Alternatives considered

### A. Keep Fastify, enforce consistent patterns

Document Fastify conventions mirroring NestJS patterns (guards-as-hooks, DI-equivalent via singletons, etc.). Cheaper short-term.

Rejected because:
- Maintaining "NestJS patterns but written in Fastify" is a constant source of subtle differences.
- Developers context-switching between 9naŭ API and nauthenticity pay a tax.
- Doesn't reduce the total number of frameworks the team supports.
- The platform's "world-class, homogeneous" objective explicitly favors consistency.

### B. Migrate 9naŭ API to Fastify (the other direction)

Fastify is lighter, faster on micro-benchmarks. Some argue NestJS is over-engineered.

Rejected because:
- 9naŭ API has ~15 modules, auth, ~30 endpoints with complex authorization — benefits from NestJS's structure.
- Migration cost would be equivalent, less justified (9naŭ API is larger).
- NestJS's DI, guards, interceptors, pipes, exception filters are genuinely useful at this size.
- Perf difference negligible for the platform's traffic profile.

### C. Migrate nauthenticity to Next.js (like flownaŭ)

Unify frontend+backend for nauthenticity. Dashboard becomes Next.js App Router.

Rejected because:
- Nauthenticity is a data pipeline service — heavy queue workers, Apify integration, cron jobs. Next.js's serverless-leaning architecture doesn't fit long-running workers.
- Would force maintaining the React dashboard separately or rewriting it.
- Higher migration cost, lower fit.

## Consequences

### Positive

- **One backend framework** across all non-UI services (9naŭ API, nauthenticity).
- **Shared packages apply cleanly**: `@nau/auth` has NestJS guards; nauthenticity can now use them directly.
- **Module organization** improves maintainability as the codebase grows.
- **BullMQ via `@nestjs/bullmq`** gives typed queue definitions, decorator-based processors, and built-in health checks.
- **Validation** standardizes on `class-validator` + `ValidationPipe` (or zod with `@nestjs/zod`).
- **Code reuse**: middleware, interceptors, filters can be lifted into shared packages and used by both backends.

### Negative

- **Migration cost**: 2–3 days of focused work (absorbed in Phase 5 of the [roadmap](../future/ROADMAP.md)). Pre-launch, so no production disruption.
- **NestJS has more boilerplate** than Fastify for simple CRUD. Acceptable given the service's complexity.
- **Startup time** slightly higher (DI container initialization). Sub-second for nauthenticity's size.

### Learning curve

Developers familiar with 9naŭ API's NestJS patterns will be immediately productive in the migrated nauthenticity. Current Fastify code is largely procedural and transitions well to NestJS's controller/service pattern.

### Performance

Fastify vs NestJS perf delta is <5% on realistic workloads (see any microbenchmark). Nauthenticity's bottlenecks are Apify, Postgres, and OpenAI calls — framework overhead is in the noise.

## References

- [../services/nauthenticity.md](../services/nauthenticity.md) — target service spec
- [../future/ROADMAP.md §Phase 5](../future/ROADMAP.md#phase-5--nauthenticity-refactor-fastify--nestjs)
- [NestJS docs](https://docs.nestjs.com) (external)
