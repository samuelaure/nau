# Service — 9naŭ API

- **Domain:** `api.9nau.com`
- **Role:** Platform control plane. Source of truth for all identity, tenancy, brands, social profiles, and prompts. Issues authentication tokens.
- **Stack:** NestJS · Prisma · PostgreSQL · Redis · BullMQ
- **Owned entities:** `User`, `Session`, `ServiceClient`, `AuthLinkToken`, `Workspace`, `WorkspaceMember`, `Brand`, `SocialProfile`, `Prompt`, plus the Second Brain subsystem (`Block`, `Relation`, `Schedule`, `JournalEntry`).

> Full field-by-field schemas in [../platform/ENTITIES.md](../platform/ENTITIES.md).

---

## Responsibilities

1. **Authentication & authorization** — mint JWTs, rotate refresh sessions, verify service tokens, resolve user → scope.
2. **Tenancy** — workspaces, workspace membership, invite flow.
3. **Brand fleet** — CRUD brands, including DNA fields (voice, comment strategy, timezone).
4. **Social profiles** — CRUD `SocialProfile` rows in every role (owned, monitored, benchmark, inspiration).
5. **Prompts** — centralized `Prompt` table with resolution fallback (BRAND → WORKSPACE → PLATFORM).
6. **Second Brain** (separate subsystem) — blocks, sync, triage, journal summaries, media, schedule.
7. **Cross-service look-ups** — service endpoints for zazu, flownaŭ, nauthenticity to resolve user/workspace/brand IDs.

---

## URL surface

See [../platform/API-CONTRACT.md §1](../platform/API-CONTRACT.md#1-api9naucom--9naŭ-api-control-plane) for the complete, authoritative endpoint list.

---

## Key conventions

- Routes mounted at **root**, no `/api` prefix (decision 2026-04-22).
- All protected routes go through `@nau/auth` guards:
    - `JwtAuthGuard` — user JWT
    - `ServiceAuthGuard` — service JWT (per-caller secret)
- Scope decorator `@requireScope('workspace:{{id}}:owner')` for authorization.
- Validation via `ValidationPipe` + `class-validator` (or zod via `@nestjs/zod`).
- Error responses conform to [API-CONTRACT.md §8.2](../platform/API-CONTRACT.md#error-responses).

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection |
| `REDIS_URL` | Yes | Redis (BullMQ, replay cache) |
| `AUTH_SECRET` | Yes (HS256 phase) | JWT signing secret |
| `SERVICE_SECRET_FLOWNAU` | Yes | Verify service JWTs from flownaŭ |
| `SERVICE_SECRET_NAUTHENTICITY` | Yes | Verify service JWTs from nauthenticity |
| `SERVICE_SECRET_ZAZU` | Yes | Verify service JWTs from zazu |
| `OPENAI_API_KEY` | Yes | Triage, journal syntheses |
| `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET_NAME` | Yes | Media upload |
| `PORT` | No | Default 3000 |
| `FRONTEND_URLS` | No | CORS allowlist |

---

## Status

🟡 Pre-refactor — current schema partially aligned. Full alignment in Phase 2 of the [roadmap](../future/ROADMAP.md).

## Related

- [../platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md)
- [../platform/AUTH.md](../platform/AUTH.md)
- [../platform/API-CONTRACT.md](../platform/API-CONTRACT.md)
