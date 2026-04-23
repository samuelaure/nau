# Service — flownaŭ

- **Domain:** `flownau.9nau.com`
- **Role:** Automated content creation engine. From Brand DNA + ideas to rendered videos on Instagram (and future platforms).
- **Stack:** Next.js 15 · Prisma · PostgreSQL · Redis · BullMQ · Remotion · OpenAI · Groq
- **Owned entities:** `SocialProfileCredentials`, `Asset`, `Template`, `AccountTemplateConfig`, `Composition`, `RenderJob`, `ContentIdea`, `ContentPlan`, `ContentPlanner`
- **References:** `brandId`, `workspaceId`, `socialProfileId` (from 9naŭ API)

---

## Responsibilities

1. **Ideation** — three flows (captured, manual, automatic) that produce `ContentIdea` rows.
2. **Composition** — pick template, fill slots, produce `Composition` with creative payload.
3. **Rendering** — headless Remotion renders videos; outputs to R2.
4. **Publishing** — Instagram Graph API (currently); future platforms via pluggable adapters.
5. **Scheduling** — daily plans + auto-approve settings per brand/profile.
6. **Asset management** — media uploads to R2 keyed per `SocialProfile`.

---

## URL surface

See [../platform/API-CONTRACT.md §3](../platform/API-CONTRACT.md#3-flownau9naucom--content-creation-engine).

---

## Key conventions

- API routes under `/api/v1/*`.
- Auth via `@nau/auth`:
    - User routes: `requireAuth()` middleware (cookie-based).
    - Service routes: `requireService()` middleware (JWT-based).
    - Cron routes: `validateCronSecret()`.
- Prisma calls never reach across service boundaries — brand/profile identity always fetched via `@nau/sdk`.

---

## Dependencies

- **9naŭ API** — workspace, brand, social profile, prompt lookups.
- **nauthenticity** — InspoBase digest, Brand synthesis input.
- **OpenAI / Groq** — ideation, composition, caption generation.
- **Remotion + FFmpeg** — rendering (in dedicated container for OOM isolation).
- **Instagram Graph API** — publishing.
- **R2** — asset storage.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres |
| `REDIS_URL` | Yes | Redis / BullMQ |
| `AUTH_SECRET` | Yes (HS256 phase) | JWT verification |
| `FLOWNAU_SERVICE_SECRET` | Yes | Signs outgoing service JWTs |
| `NAU_API_URL` | Yes | 9naŭ API base |
| `NAUTHENTICITY_URL` | Yes | nauthenticity base |
| `CRON_SECRET` | Yes | Cron route auth |
| `OPENAI_API_KEY` | Yes | Ideation/composition/captions |
| `GROQ_API_KEY` | No | Optional Groq fallback |
| `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET_NAME` | Yes | Media storage |
| `NEXT_PUBLIC_APP_URL` | Yes | This app's URL |
| `NEXT_PUBLIC_ACCOUNTS_URL` | Yes | SSO URL |

---

## Cron jobs

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/ideation` | hourly | Generate new ideas for auto-approve brands |
| `/api/cron/composer` | hourly | Compose approved ideas |
| `/api/cron/renderer` | every 15 min | Render pending compositions |
| `/api/cron/publisher` | every 30 min | Publish scheduled/ready compositions |
| `/api/cron/scheduler` | daily | Build daily plans |
| `/api/cron/token-refresh` | daily | Refresh Instagram OAuth tokens |
| `/api/cron/approve-renders` | every 15 min | Auto-approve rendered compositions per brand config |
| `/api/cron/reset-renders` | hourly | Reset stuck `RenderJob`s |

---

## Status

🟡 Pre-refactor — current schema uses `SocialAccount`, `BrandPersona`, `IdeasFramework`, `ContentCreationPrinciples`. Schema rebuild in Phase 6.

## Related

- [../features/content-creation-pipeline.md](../features/content-creation-pipeline.md)
- [../platform/ENTITIES.md §3](../platform/ENTITIES.md#flownau-domain-entities-owned-by-flownau)
