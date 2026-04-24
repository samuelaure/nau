# ADR-005 — Consolidate into a single pnpm + turbo monorepo

- **Status:** 🟢 Accepted
- **Date:** 2026-04-23

## Context

The platform evolved as a loose collection of separate projects, each with its own package.json, node_modules, tooling configs, and Docker setup:

```
nau-platform/
├── 9nau/              (sub-monorepo: api, accounts, app, mobile)
├── flownau/           (standalone Next.js)
├── nauthenticity/     (standalone Fastify)
├── zazu/              (sub-monorepo: bot, dashboard)
├── whatsnau/          (sub-monorepo: backend, frontend)
└── packages/storage/
```

This created:
- **Tooling drift**: each project has slightly different ESLint, Prettier, TypeScript configs.
- **No shared code**: every fetch-to-9naŭ-API is hand-rolled in each service. No `@nau/sdk` is possible without a monorepo or a publish-to-registry pipeline.
- **Cross-service refactors require multiple PRs**: rename something in 9naŭ API + flownaŭ + nauthenticity = three separate commits, three separate review cycles.
- **Duplicate dependencies**: the same pino, zod, jose installed independently in every project, inflating CI/build time.

The platform is moving to SaaS launch with several more services planned. Continuing the polyrepo pattern multiplies this pain.

## Decision

**Consolidate into a single pnpm + turbo monorepo, in-place (no directory flattening).**

The original plan called for a full `git mv` to flatten everything under a top-level `apps/`. After weighing the migration cost against the benefit (the nested layout is already navigable and all apps have Dockerfiles relative to their current location), we kept the existing directory tree and instead made the **root `pnpm-workspace.yaml`** the single source of package resolution:

### Implemented structure

```
nau-platform/
├── 9nau/
│   ├── apps/api/             — @9nau/api
│   ├── apps/accounts/        — @9nau/accounts
│   ├── apps/app/             — @9nau/app
│   ├── apps/mobile/          — mobile
│   └── packages/{core,types,ui}/
├── flownau/                  — flownau (Next.js)
├── nauthenticity/            — nauthenticity (NestJS)
├── zazu/
│   ├── apps/bot/             — @zazu/bot
│   ├── apps/dashboard/       — @zazu/dashboard
│   └── packages/{db,skills-core,feature-conversational}/
├── packages/                 ← @nau/* shared packages
│   ├── auth/                 — @nau/auth
│   ├── types/                — @nau/types
│   ├── sdk/                  — @nau/sdk
│   ├── config/               — @nau/config
│   ├── logger/               — @nau/logger
│   └── storage/              — @nau/storage
├── docs/
├── pnpm-workspace.yaml       ← includes all of the above
├── turbo.json
└── package.json
```

`pnpm-workspace.yaml` globs:
```yaml
packages:
  - 'packages/*'
  - '9nau/apps/*'
  - '9nau/packages/*'
  - 'nauthenticity'
  - 'flownau'
  - 'zazu/apps/*'
  - 'zazu/packages/*'
```

All `file:` references to `@nau/*` and `@zazu/*` packages replaced with `workspace:*` so pnpm resolves them as symlinks from the workspace root.

### Independent deployment

Deployment stays **per-app**, not "one deploy for everything":

- Each app has its own `Dockerfile` in its directory.
- GitHub Actions uses path-based filtering to trigger builds/deploys only for changed apps:

    ```yaml
    paths:
      - 'apps/flownau/**'
      - 'packages/*/**'   # but only the packages flownau depends on
    ```

- Turbo's dependency graph detects which packages/apps are affected by a change and runs only relevant tasks.

### Shared tooling

- One `tsconfig.base.json` at root; each app extends it.
- One ESLint config at root; each app may override.
- One Prettier config.
- Husky pre-commit hook runs changed-only lint/format.

## Alternatives considered

### A. Keep polyrepo, publish shared packages to private npm

Each service stays standalone; shared code (@nau/sdk, @nau/auth) is published to a private npm registry or GitHub Packages.

Rejected because:
- Every shared-package change requires publish + manual bump in every consumer
- Slow iteration when refactoring cross-service concerns
- Requires setting up and maintaining a private registry
- Git history diverges — searching "when did X change across all services" is painful

### B. Single repo, no workspace tooling

Just put everything in one git repo with no shared deps. Each app has its own node_modules and package.json at a sibling level.

Rejected because:
- Duplicated node_modules waste disk and build time
- No dependency graph → CI has to rebuild everything on every commit
- No way to share packages without symlinks or publish step

### C. Nx instead of Turbo

Nx is a more feature-rich monorepo tool than Turbo (has generators, more plugins, affected-detection).

Rejected because:
- Turbo is lighter-weight, good enough for our scale (10 apps)
- Nx's opinionated conventions (code generation, library vs app distinction) add ceremony
- Turbo integrates more naturally with Next.js (Vercel product)

Revisit if we hit Turbo's limitations (e.g., we want automated code scaffolding).

### D. Keep sub-monorepos (9nau/, zazu/, whatsnau/) inside the root workspace

Keep each sub-tree with its own workspace config.

Rejected because the nesting complicates path filtering in CI and makes "which app does this file belong to" ambiguous. Flat is better than nested.

## Consequences

### Positive

- **One `pnpm install`** installs all dependencies; deduped automatically.
- **Atomic cross-service refactors**: "rename workspace → team" in one commit touching every app.
- **`@nau/sdk` etc. just work** — no publish step.
- **Consistent tooling**: one ESLint config, one tsconfig base, one test runner (Vitest).
- **Faster CI**: turbo caches build outputs; unaffected apps skip their build.
- **Easier onboarding**: one repo to clone, one README to read, one `pnpm dev` to start local dev.
- **Git history preserved** via `git mv` during Phase 8.

### Negative

- **Repo size grows** over time. At the projected scale (10 apps, 7 packages), still well within pnpm's comfort zone.
- **Local dev RAM**: running all services simultaneously needs ~2 GB. Mitigated by `turbo dev --filter=<app>` to run only what you're working on.
- **CI configuration complexity**: path filters + turbo config require setup care. One-time cost.
- **Single point of failure for git**: a bad merge can affect multiple apps. Mitigated by branch protection, required reviews, and per-path CODEOWNERS.

### Migration cost

Phase 8 of the [roadmap](../future/ROADMAP.md). Mostly mechanical: `git mv`, update paths, update Dockerfiles, update docker-compose, update CI. No semantic changes — it's purely reorganization. Estimate: half a day of focused work + CI iteration.

## References

- [../future/ROADMAP.md §Phase 8](../future/ROADMAP.md#phase-8--monorepo-consolidation)
- [Turbo docs](https://turbo.build/repo/docs) (external)
- [pnpm workspaces](https://pnpm.io/workspaces) (external)
