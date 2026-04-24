# ADR-008 — Monorepo consolidation: 15 repos → 1 pnpm workspace

- **Status:** 🟢 Accepted
- **Date:** 2026-04-24

## Context

The platform grew as separate git repositories per service. This created:
- Dependency duplication — `@nau/auth`, `@nau/types`, etc. copied across repos
- Inconsistent tooling versions (different Node, pnpm, TypeScript versions per repo)
- Cross-service changes required coordinated PRs across multiple repos
- No shared CI conventions — each repo had its own pipeline style
- Difficulty enforcing platform-wide standards (linting, testing, auth patterns)

## Decision

Consolidate all services into a single pnpm workspace monorepo managed with Turborepo.

### Repository structure

```
nau/                          ← github.com/samuelaure/nau
├── apps/
│   ├── api/                  ← NestJS platform control plane
│   ├── accounts/             ← Next.js SSO identity hub
│   ├── app/                  ← Next.js Second Brain UI
│   ├── flownau/              ← Next.js content engine
│   ├── nauthenticity/        ← NestJS brand intelligence
│   ├── zazu-bot/             ← Express Telegram bot
│   ├── zazu-dashboard/       ← Next.js Telegram Mini App
│   ├── whatsnau/             ← NestJS WhatsApp CRM
│   └── mobile/               ← Expo mobile app
├── packages/
│   ├── auth/                 ← @nau/auth — JWT, guards, cookie builders
│   ├── types/                ← @nau/types — canonical enums and DTOs
│   ├── sdk/                  ← @nau/sdk — typed API client
│   ├── logger/               ← @nau/logger — structured logging (pino)
│   ├── config/               ← @nau/config — shared config helpers
│   ├── storage/              ← @nau/storage — Cloudflare R2 client
│   ├── zazu-db/              ← @zazu/db — Prisma schema for zazu
│   ├── skills-core/          ← @zazu/skills-core — bot skill framework
│   └── feature-conversational/ ← @zazu/feature-conversational
└── docs/                     ← Architecture, ADRs, service docs
```

### Dependency resolution

Packages reference each other via `workspace:*` protocol in `package.json`. Turborepo's build pipeline ensures packages are built before apps that depend on them.

### History preservation

Each service's full git history was preserved using `git filter-repo --path-rename` to rewrite each repo's history into its target subdirectory, then merged with `--allow-unrelated-histories`. No squash commits.

## Consequences

### Positive
- Single `pnpm install` installs all dependencies
- `pnpm turbo build` builds everything in dependency order with caching
- Atomic cross-service changes in one PR
- Shared CI conventions enforced at the monorepo level
- Package changes automatically trigger CI for all dependent apps (via `paths: packages/**`)

### Negative
- Larger repository — initial clone includes all service history
- Docker builds must use full monorepo context (all Dockerfiles `COPY` from root)
- More complex Dockerfiles to manage pnpm workspace hoisting
