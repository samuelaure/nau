# naŭ Platform — Documentation

> Canonical documentation for the naŭ Platform ecosystem.
> This is the single source of truth. Everything else (inline comments, memory notes, legacy `.agent/` docs) defers to what is written here.

---

## What naŭ Platform is

naŭ Platform is a multi-service SaaS for solopreneurs and creators who manage a **fleet of brands**, each with a presence on multiple social platforms (Instagram, TikTok, and planned YouTube). The platform automates ideation, content creation, publishing, competitor monitoring, audience engagement, and intelligence gathering across the fleet.

The platform is organized as **Workspace → Brand → SocialProfile**, with every shared identity entity centralized in the 9naŭ API (control plane) and every service owning only its domain data.

## Who this doc set is for

- **Developers** building or modifying any service in the platform.
- **Operators** deploying, monitoring, or troubleshooting the platform.
- **Founders / product** making architectural decisions.

Every decision that has long-term consequence is captured as an ADR in `decisions/`. Every user-visible concept has a canonical name in `platform/NAMING.md`. Every URL in the platform is listed in `platform/API-CONTRACT.md`.

---

## Where to start

| You want to... | Read |
|---|---|
| Understand the full architecture | [platform/ARCHITECTURE.md](platform/ARCHITECTURE.md) |
| Know what each entity looks like in code | [platform/ENTITIES.md](platform/ENTITIES.md) |
| Understand auth (user SSO + service-to-service) | [platform/AUTH.md](platform/AUTH.md) |
| Find an endpoint | [platform/API-CONTRACT.md](platform/API-CONTRACT.md) |
| Learn the naming rules | [platform/NAMING.md](platform/NAMING.md) |
| See what a single service does | `services/<name>.md` |
| See how a feature works end-to-end | `features/<name>.md` |
| Know the historical reasoning behind a decision | `decisions/ADR-###-*.md` |
| See what's coming next | [future/ROADMAP.md](future/ROADMAP.md) |

---

## Documentation index

### Platform-level (read these first)

- **[ARCHITECTURE.md](platform/ARCHITECTURE.md)** — services, ownership, data flow, dependency graph
- **[ENTITIES.md](platform/ENTITIES.md)** — Workspace, Brand, SocialProfile, Prompt — field-by-field spec
- **[AUTH.md](platform/AUTH.md)** — SSO flow, refresh tokens, service auth, CSRF
- **[API-CONTRACT.md](platform/API-CONTRACT.md)** — every endpoint across every service
- **[NAMING.md](platform/NAMING.md)** — canonical naming, URL patterns, header conventions

### Services

- [services/9nau-api.md](services/9nau-api.md) — platform control plane (NestJS)
- [services/accounts.md](services/accounts.md) — SSO identity provider (Next.js)
- [services/app.md](services/app.md) — 9naŭ Second Brain web app (Next.js)
- [services/mobile.md](services/mobile.md) — 9naŭ mobile app (Expo)
- [services/flownau.md](services/flownau.md) — automated content creation engine (Next.js)
- [services/nauthenticity.md](services/nauthenticity.md) — brand intelligence & monitoring (NestJS, pgvector)
- [services/zazu-bot.md](services/zazu-bot.md) — Telegram bot (Telegraf)
- [services/zazu-dashboard.md](services/zazu-dashboard.md) — Telegram mini-app console (Next.js)
- [services/whatsnau.md](services/whatsnau.md) — WhatsApp CRM (standalone)

### Shared packages

- [packages/sdk.md](packages/sdk.md) — `@nau/sdk` — typed client for the platform
- [packages/auth.md](packages/auth.md) — `@nau/auth` — JWT, cookies, CSRF, service tokens
- [packages/types.md](packages/types.md) — `@nau/types` — canonical TypeScript types
- [packages/config.md](packages/config.md) — `@nau/config` — zod env validation
- [packages/logger.md](packages/logger.md) — `@nau/logger` — pino setup
- [packages/ui.md](packages/ui.md) — `@nau/ui` — shared React components
- [packages/storage.md](packages/storage.md) — R2 storage client

### Features (end-to-end flows)

- [features/content-creation-pipeline.md](features/content-creation-pipeline.md) — ideation → composition → render → publish
- [features/brand-intelligence.md](features/brand-intelligence.md) — DNA, InspoBase, benchmark chat
- [features/comment-suggester.md](features/comment-suggester.md) — reactive + proactive suggestion flow
- [features/sso.md](features/sso.md) — end-to-end login flow

### Future work (scoped but not yet built)

- [future/ROADMAP.md](future/ROADMAP.md) — the phased plan for this refactor and beyond
- [future/content-origins-expansion.md](future/content-origins-expansion.md) — YouTube transcripts, blog articles as content sources
- [future/social-platform-expansion.md](future/social-platform-expansion.md) — TikTok, YouTube publishing
- [future/rs256-jwks-migration.md](future/rs256-jwks-migration.md) — asymmetric JWT upgrade path
- [future/atomic-brand-lifecycle.md](future/atomic-brand-lifecycle.md) — event-driven brand CRUD at SaaS scale
- [future/brand-collaboration.md](future/brand-collaboration.md) — brand-level (not workspace-level) membership
- [future/rag-knowledge-base.md](future/rag-knowledge-base.md) — pgvector-backed brand chatbots & profile chat-UI
- [future/observability.md](future/observability.md) — metrics, tracing, alerting

### Decisions

See `decisions/`. The index: [decisions/README.md](decisions/README.md).

---

## Conventions used in this doc set

- Code references use the pattern `[filename.ts:42](path/to/filename.ts#L42)`.
- All entity names are PascalCase (`SocialProfile`, not `SocialAccount`).
- All URL paths are kebab-case (`/social-profiles`, not `/socialProfiles`).
- All header names are kebab-case, lower-cased (`x-nau-service-key`).
- Environment variables are UPPER_SNAKE_CASE with a `NAU_` prefix when platform-wide (`NAU_SERVICE_KEY`) or service-scoped otherwise (`FLOWNAU_SERVICE_SECRET`).

See [platform/NAMING.md](platform/NAMING.md) for the full canon.

---

## Status of this doc set

This doc set is being built as part of the April 2026 foundational refactor. Some documents may be stubs until their corresponding phase of the refactor is complete — see [future/ROADMAP.md](future/ROADMAP.md) for the execution plan.
