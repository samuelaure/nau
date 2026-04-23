# naŭ Platform — Architecture

> The big picture: what the platform does, how services cooperate, and who owns which data.

---

## 1. Platform purpose

naŭ Platform is a multi-tenant SaaS for creators managing a **fleet of brands**, each with a presence on multiple social platforms. The platform provides:

- **Centralized identity** (9naŭ API) — one account, one workspace, one brand fleet, accessed from every app.
- **Content automation** (flownaŭ) — ideation → composition → render → publish, for each owned social profile.
- **Brand intelligence** (nauthenticity) — scraping, transcription, semantic search, competitor benchmarking, inspiration capture.
- **Comment engagement** (nauthenticity + zazu) — AI-generated comment suggestions on targeted profiles, delivered via Telegram.
- **Mobile capture** (9naŭ mobile) — in-context Instagram overlay for sending posts to InspoBase or generating reactive comments.
- **Second Brain** (9naŭ app) — personal productivity block editor that cross-pollinates with brand content via AI triage.
- **WhatsApp CRM** (whatsnaŭ) — standalone, kept for completeness.

---

## 2. Services and responsibilities

| Service | Type | Role | Tech |
|---|---|---|---|
| **9naŭ API** (`api.9nau.com`) | Backend | **Platform control plane.** Owns User, Workspace, Brand, SocialProfile, Prompt, Session. Issues JWTs. Authoritative for all shared identity. | NestJS, PostgreSQL, Prisma |
| **accounts** (`accounts.9nau.com`) | Frontend | SSO identity provider UI. Handles login, register, password reset, Telegram linking. Owns zero data — proxies to 9naŭ API. | Next.js 15 (server actions) |
| **9naŭ app** (`app.9nau.com`) | Frontend | Personal productivity Second Brain UI (blocks, journal, search). | Next.js 15 |
| **9naŭ mobile** | Mobile | Instagram capture overlay, voice capture, mobile access to Second Brain. | Expo / React Native |
| **flownaŭ** (`flownau.9nau.com`) | Full-stack | Content creation engine: ideation, composition, video rendering (Remotion), Instagram publishing, scheduling. Owns Assets, Compositions, Templates, RenderJobs. Stores OAuth credentials for owned SocialProfiles. | Next.js 15, PostgreSQL, Prisma, BullMQ, Remotion |
| **nauthenticity** (`nauthenticity.9nau.com`) | Full-stack | Brand intelligence: Instagram scraping (Apify), transcription, semantic search, benchmark/monitor, InspoBase, comment generation. | NestJS, PostgreSQL + pgvector, Prisma, BullMQ |
| **zazu-bot** | Backend | Telegram bot for voice journal, daily briefs, comment suggestions, brand capture, and platform commands. | Node.js, Telegraf |
| **zazu-dashboard** | Frontend | Telegram Mini App — in-chat UI for brand selection, target management, feedback. | Next.js 15 |
| **whatsnaŭ** | Standalone | WhatsApp CRM. Not integrated with the rest of the platform this round. | Node.js, Prisma, React/Vite |

---

## 3. Entity ownership — the central table

Every entity in the platform has exactly one owning service. When in doubt, this table wins.

| Entity | Owned by | Referenced by |
|---|---|---|
| `User` | 9naŭ API | All services (via `sub` claim in JWT) |
| `Session` | 9naŭ API | — |
| `ServiceClient` | 9naŭ API | — |
| `Workspace` | 9naŭ API | flownaŭ, nauthenticity, zazu (as `workspaceId` string) |
| `WorkspaceMember` | 9naŭ API | — |
| `Brand` | 9naŭ API | flownaŭ, nauthenticity, zazu (as `brandId` string) |
| `SocialProfile` | 9naŭ API | flownaŭ, nauthenticity, zazu (as `socialProfileId` string) |
| `Prompt` | 9naŭ API | flownaŭ, nauthenticity, zazu (consumed by `ownerType` + `ownerId` + `type`) |
| `SocialProfileCredentials` (OAuth tokens for OWNED profiles) | flownaŭ | — |
| `Asset`, `Template`, `Composition`, `RenderJob`, `ContentPlan`, `ContentIdea` | flownaŭ | — |
| `Post`, `Media`, `Transcript`, `Embedding`, `ScrapingRun` | nauthenticity | — |
| `InspoItem`, `BrandSynthesis`, `CommentFeedback` | nauthenticity | — |
| `TelegramUser` (link table), `ConversationState` | zazu-bot | — |
| `Block`, `JournalEntry`, `Schedule` | 9naŭ API (Second Brain subsystem) | 9naŭ app, mobile |

See [ENTITIES.md](ENTITIES.md) for field-by-field schemas.

---

## 4. Rules of the platform

These are non-negotiable invariants. Every new feature, every PR, conforms to them.

1. **Identity centralization.** User, Workspace, Brand, SocialProfile, and Prompt are owned by 9naŭ API. No other service creates or duplicates these tables.
2. **Reference by ID, never by value.** Downstream services store `workspaceId`, `brandId`, `socialProfileId` as strings. They never clone name, timezone, voicePrompt, etc.
3. **One entity per concept, even across roles.** A `SocialProfile` is a `SocialProfile` whether it's owned for publishing or monitored for benchmark. The `role` field distinguishes, not a separate table.
4. **One prompt table for all prompts.** No per-feature prompt tables. `Prompt.ownerType` + `Prompt.type` covers every use case.
5. **One auth vocabulary.** All JWTs verified via `@nau/auth`. All service-to-service calls use signed service JWTs (not shared keys). See [AUTH.md](AUTH.md).
6. **One SDK.** All apps consume 9naŭ API via `@nau/sdk`. Hand-rolled `fetch` calls to `api.9nau.com` are forbidden.
7. **Per-service databases.** Each service owns its Postgres instance. Cross-service reads happen via API, not DB JOINs.
8. **Domain boundaries are enforced in code.** If service A needs data owned by service B, it calls service B's API. No direct DB access across boundaries.

---

## 5. Data flow

### 5.1. User-initiated brand creation

```
User at flownau.9nau.com/dashboard
    │ clicks "Create brand"
    ▼
flownau Next.js server action
    │ fetch via @nau/sdk
    ▼
api.9nau.com  POST /workspaces/:id/brands
    │ JWT user auth
    │ assertMembership(user, workspace)
    │ create Brand row
    │ emit brand.created event (future: outbox)
    ▼
return { brand }
    │
    ▼ (async, fire-and-forget for now; outbox later)
nauthenticity + flownaŭ receive no sync write — they LAZILY create domain rows
when first queried (Brand is addressable by id; domain rows optional)
```

### 5.2. Content idea ingestion from mobile capture

```
User taps "Send to InspoBase" on 9naŭ mobile (Instagram overlay)
    │
    ▼
POST api.9nau.com/triage  (user JWT)
    │ classify capture → InspoBase intent
    ▼
POST nauthenticity.9nau.com/api/v1/brands/:id/inspo  (service JWT iss=9nau-api)
    │ create InspoItem { brandId, sourceUrl, status: PENDING }
    ▼
ingestion worker picks up → scrape via Apify → create Post → transcribe → embed
    │
    ▼
(later) flownaŭ reads InspoBase via @nau/sdk → generates ContentIdea → Composition → ...
```

### 5.3. Daily content ideation cron

```
flownaŭ cron /api/cron/ideation (CRON_SECRET)
    │ for each Brand with automaticAutoApprove
    │ fetch Brand + Prompts (VOICE, IDEAS_FRAMEWORK, CONTENT_PERSONA) via @nau/sdk
    │ fetch InspoBase digest from nauthenticity
    │ generate ideas via OpenAI
    │ persist ContentIdea rows
    ▼
(next cron) composer → select template → build Composition
    ▼
(next cron) renderer → Remotion render → upload to R2
    ▼
(next cron) publisher → Instagram Graph API
```

### 5.4. Comment suggestion (reactive)

```
User taps "Suggest comment" on 9naŭ mobile (for a targetpost)
    │
    ▼
POST nauthenticity.9nau.com/api/v1/brands/:id/comment-suggestions  (user JWT)
    │ body: { postUrl }
    │ scrape post, fetch Brand + commentStrategy prompt from 9naŭ API
    │ generate suggestions via OpenAI
    │ deliver via Telegram through zazu-bot
    ▼
User taps "Use this comment" → feedback logged in CommentFeedback
```

### 5.5. Brand benchmark chat

```
User opens nauthenticity.9nau.com/brands/:id/benchmark/:profileId/chat
    │
    ▼
User asks "What tone does @nike use in reels?"
    │ embed query via OpenAI
    │ pgvector cosine search over Embeddings for (platform='instagram', platformId=@nike)
    │ retrieve top-K chunks
    │ feed to LLM with system prompt from Prompt table
    ▼
answer streamed back
```

---

## 6. Dependency graph

```
                                 ┌─────────────────┐
                                 │  9naŭ API       │
                                 │  (api.9nau.com) │
                                 │  Identity SoT   │
                                 └────────┬────────┘
                                          │ JWT verify / SDK calls
            ┌─────────────────────────────┼─────────────────────────────────┐
            │                             │                                 │
            ▼                             ▼                                 ▼
    ┌──────────────┐             ┌──────────────┐                  ┌──────────────┐
    │ accounts     │             │  flownaŭ     │                  │ nauthenticity │
                                 └────────────┘                     └────────────┘

    ┌──────────────┐             ┌──────────────┐
    │ 9naŭ mobile  │             │  zazu-bot    │
    │ (Expo)       │─────────────▶│ (Telegraf)   │──── Telegram Bot API
    └──────────────┘             └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │zazu-dashboard│
                                 │(Mini App UI) │
                                 └──────────────┘
```

Legend:
- Solid arrows: HTTP/API dependency
- Every arrow terminating at 9naŭ API carries either user JWT (client-origin) or service JWT (service-to-service).

---

## 7. Deployment topology

Single Hetzner CX23 server today (4 GB RAM, 2 vCPU). Traefik reverse proxy terminates TLS on:

- `api.9nau.com` → `9nau-api:3000`
- `accounts.9nau.com` → `accounts:3000`
- `app.9nau.com` → `app:3000`
- `flownau.9nau.com` → `flownau:3000`
- `nauthenticity.9nau.com` → `nauthenticity:3000`
- `zazu.9nau.com` → `zazu-dashboard:3000`
- `whatsnau.9nau.com` → `whatsnau:3000`

Each service has its own Postgres (per-service isolation) and shares one Redis instance for BullMQ + session storage. Media in Cloudflare R2 (`users/{userId}/…`, `brands/{brandId}/…`).

**Future:** as tenant count grows, split DBs per service into managed PG (Neon / RDS), move Redis to managed, add replica for nauthenticity (heavy scraping).

---

## 8. Related docs

- [ENTITIES.md](ENTITIES.md) — data model spec
- [AUTH.md](AUTH.md) — auth model spec
- [API-CONTRACT.md](API-CONTRACT.md) — endpoint catalog
- [NAMING.md](NAMING.md) — naming rules
- [../decisions/](../decisions/) — architectural decisions (ADRs)
