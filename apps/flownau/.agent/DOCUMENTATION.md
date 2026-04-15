# flownaŭ — Documentation

## Identity

- **Type:** A — Platform Service (headless API + internal dashboard)
- **Domain:** Content creation, scene-based video/image composition, automated publishing
- **Status:** Active — Phase 7 Workspace Architecture complete, ready for Phase 8

## Purpose

Automated content generation and distribution engine for the naŭ Platform. Converts content ideas into high-quality, brand-aligned social media assets (Reels, Trial Reels, Carousels, Single Images) using scene-based composition with AI-driven creative direction and deterministic assembly. Publishes to Instagram via the Graph API.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Video Engine:** Remotion 4 (Headless, dedicated container)
- **ORM:** Prisma 7
- **Database:** PostgreSQL 15
- **Queue:** Redis 7 + BullMQ (render job queue)
- **AI:** OpenAI GPT-4o (composition — Structured Outputs), Groq Llama 3.3 (ideation)
- **Storage:** Cloudflare R2 (S3-compatible)
- **Video Processing:** FFmpeg 6
- **Publishing:** Instagram Graph API v19+
- **Auth:** NextAuth (dashboard), NAU_SERVICE_KEY (cross-service)

## Architecture Overview

### Core Pipeline

```
Ideation → Scene Composition (AI) → Timeline Assembly (Code) → Render (Async) → Publish (IG)
```

### Module Breakdown

- **`composer/`** — Core pipeline: SceneComposer (AI), TimelineCompiler (deterministic), AssetCurator (intelligent selection)
- **`scenes/`** — Remotion component library: video scenes (HookText, TextOverMedia, QuoteCard, ListReveal, MediaOnly, CTA) + image scenes (Cover, Content, Quote, List, CTA)
- **`renderer/`** — Dedicated render worker: BullMQ queue, renderMedia (video), renderStill (images), R2 upload
- **`publisher/`** — Instagram publishing: Reels, Trial Reels, Carousels, Photos, token refresh
- **`ideation/`** — Content idea generation from multiple sources (InspoItems, Brand DNA, external)
  - **`ideation/sources/`** — Source adapters: `inspo-source.ts` (nauthenticity), `brand-dna-source.ts`, `external-source.ts`
- **`planning/`** — Daily content plan generation, head-talk script detection, alerts (token/asset/idea)
- **`shared/`** — Prisma, R2, encryption, logger, NAU_SERVICE_KEY auth

### Key Design Principles

1. **AI writes, code assembles.** LLM generates creative text + scene sequences. Deterministic code handles layout, timing, frame math, asset resolution.
2. **Scene-based composition.** Atomic scene components are the creative primitives. The AI has structural creativity (scene selection + ordering) while each scene is a tested Remotion component.
3. **Audio-first timing.** Audio duration drives all frame calculations.
4. **Rendering is isolated.** Dedicated container, async BullMQ queue.

## Domain Ownership

### Owns

- Content composition (scene-based video/image generation)
- Remotion rendering (headless, server-side)
- Asset management (R2 sync, tagging, intelligent curation)
- Instagram publishing (Reels, Trial Reels, Carousels, Photos)
- Content scheduling (posting schedule, time-of-day slots)
- Content planning (daily plans, recording scripts)
- Workspace & Brand organization (Multi-tenant hierarchy)

### Consumes

- **nauthenticity:** InspoItems + Brand DNA for ideation
- **9naŭ API (triage module):** Voice transcripts ingested as content ideas
- **9naŭ API:** Reactive content triggers from user's Second Brain

## API Surface

### Cross-Service (NAU_SERVICE_KEY auth)

| Method | Endpoint                                      | Purpose                                                              |
| ------ | --------------------------------------------- | -------------------------------------------------------------------- |
| GET    | `/api/v1/health`                              | Health check                                                         |
| POST   | `/api/v1/compose`                             | Trigger reactive composition (creates idea + optional full pipeline) |
| POST   | `/api/v1/ideas/ingest`                        | Bulk ingest ideas with dedup (up to 50)                              |
| GET    | `/api/v1/daily-plan/:accountId`               | Daily plan with pieces, scripts, alerts, stats                       |
| GET    | `/api/v1/daily-plan/:accountId?reminder=true` | Condensed plan (pending items only)                                  |
| GET    | `/api/v1/accounts`                            | List social accounts                                                 |
| GET    | `/api/v1/compositions?accountId=X&status=Y`   | Query compositions with filters                                      |

### Crons

| Endpoint                      | Purpose                                    |
| ----------------------------- | ------------------------------------------ |
| GET `/api/cron/ideation`      | Generate content ideas on schedule         |
| GET `/api/cron/composer`      | Compose approved ideas into content pieces |
| GET `/api/cron/publisher`     | Publish rendered content per schedule      |
| GET `/api/cron/daily-plan`    | Generate daily content plans               |
| GET `/api/cron/token-refresh` | Refresh expiring IG tokens                 |

## Environment Variables

| Variable                         | Required | Purpose                               |
| -------------------------------- | -------- | ------------------------------------- |
| DATABASE_URL                     | Yes      | Postgres connection                   |
| REDIS_URL                        | Yes      | Redis connection (BullMQ)             |
| REDIS_PASSWORD                   | Yes      | Redis auth                            |
| OPENAI_API_KEY                   | Yes      | GPT-4o for composition                |
| GROQ_API_KEY                     | Yes      | Llama 3.3 for ideation                |
| R2_ACCESS_KEY, R2_SECRET_KEY     | Yes      | Cloudflare R2 storage                 |
| R2_BUCKET_NAME, R2_PUBLIC_URL    | Yes      | R2 bucket config                      |
| FB_APP_ID, FB_APP_SECRET         | Yes      | Instagram Graph API                   |
| NAU_SERVICE_KEY                  | Yes      | Cross-service auth                    |
| NAUTHENTICITY_URL                | Yes      | nauthenticity service URL             |
| NEXTAUTH_SECRET, NEXTAUTH_URL    | Yes      | Dashboard auth                        |
| RENDER_CONCURRENCY               | No       | Frames in parallel (default: 2)       |
| RENDER_MAX_ATTEMPTS              | No       | Max retry per render job (default: 3) |
| TOKEN_REFRESH_DAYS_BEFORE_EXPIRY | No       | Token refresh buffer (default: 7)     |

- **[2026-04-15] Phase 7 — Workspace Multi-Tenancy (complete)**: Transformed the app to a multi-tenant Workspace architecture. `SocialAccount` now belongs to `Workspace` (not `User`). Users join workspaces via `WorkspaceUser` join table with roles. New auth flow: `/register` creates user + personal workspace atomically. Dashboard root auto-redirects to the user's workspace. Account detail view now shows posting schedule as the primary tab. All API ownership checks migrated from `account.userId` to `checkAccountAccess()` workspace membership helper.
- **[2026-04-13] Phase 6 — Frontend Dashboard Refactoring**: New pages for Compositions (`/dashboard/compositions`), Daily Plans (`/dashboard/plans`), and Ideas (`/dashboard/ideas`). Account detail extended with token health pill and new scheduler fields. Overview page refactored to remove legacy `Render` query. Sidebar expanded with new nav links.
- **[2026-04-13] Content Plan & Platform Integration (Phase 5)**: Implemented daily plan generation with head-talk detection, alerts (token/asset/idea), and Zazŭ delivery contract. Connected nauthenticity InspoItems as ideation source with graceful degradation. All v1 cross-service endpoints now fully functional.
- **[2026-04-13] Diversity Tracking**: Added `sceneTypes[]` and `topicHash` to Composition model. Ideation cron now queries last 14 days of content to avoid repetition.
- **[2026-04-13] Reactive Composition Triggers**: `/api/v1/compose` runs the full AI → compile → render pipeline in a single call when `autoApprove=true`.
- **[2026-04-13] Multi-Format Publish Orchestrator**: Refactored the publisher into a modular, orchestrator-based system. Supports mapping compositions to format-specific publishers (Reels, Trial Reels, Carousels, Single Images) while reusing shared status polling capabilities.
- **[2026-04-13] Proactive Token Refresh**: Added automated IG token refresh cron. Checks `tokenExpiresAt` and uses `fb_exchange_token` to renew tokens extending system autonomy.
- **[2026-04-13] Time-of-Day Scheduling**: Integrated `scheduler.ts` into the Publisher cron to automatically assign unscheduled, rendered compositions into configurable daily posting time slots before routing to the publisher.
- **[2026-04-13] Async Render Pipeline**: Added BullMQ-based render queue. Dedicated renderer container (1.5GB Chromium+FFmpeg) processes jobs asynchronously. Publisher cron fully decoupled — only publishes pre-rendered content.
- **[2026-04-12] Scene-Based Composition**: Replaced free-form LLM JSON generation with scene-based composition. AI fills typed text slots; deterministic code handles layout, timing, and asset resolution.
- **[2026-04-12] Dedicated Render Container**: Rendering decoupled to own container (1.5GB) with BullMQ queue. App stays at 384MB.
- **[2026-04-12] B-Roll Primary**: TextOverMedia is the primary scene type, optimized for B-roll heavy Reels content.
- **[2026-04-12] Asset Intelligence**: Tags, duration filtering, recency tracking, and usage counting for asset curation. Eliminates black frames and repetition.
- **[2026-04-10] Deterministic Asset Caching**: Slicing library before shuffling ensures cache stability.
- **[2026-04-10] Multi-Tier Publishing**: Support for explicit scheduling + auto-posting schedules.
- **[2026-04-07] Exclusive IG Owner**: flownaŭ owns all platform-wide Instagram publishing.

## Known Limitations

- CX23 server constrains rendering throughput (~5 min per reel at 1.5GB)
- Instagram API rate limit: 100 posts per 24h per account
- Long-lived IG tokens expire after 60 days (auto-refresh implemented)
- Still rendering for carousels is sequential (1 slide at a time in renderer)

## Deployment Notes

- **Server:** Hetzner CX23 (4GB RAM, 2 vCPU)
- **Containers:** app (384MB), renderer (1.5GB), postgres (192MB), redis (64MB)
- **Network:** `nau-network` (external, shared with Traefik)
- **Domain:** `flownau.9nau.com` (via Traefik)
- **CI/CD:** GHA → GHCR → docker compose pull on server

## naŭ Platform Dependencies

- **nauthenticity** → Provides InspoItems and Brand DNA for ideation
- **9naŭ API (triage module)** → Sends voice transcript ideas via `/api/v1/ideas/ingest`
- **9naŭ API** → Triggers reactive composition via `/api/v1/compose`
- **Zazŭ** → Consumes daily plan via `/api/v1/daily-plan/:accountId` + triggers composition
