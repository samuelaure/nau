# naŭ Platform — Ecosystem Documentation

> **⚠️ This file is a legacy stub. The canonical documentation has moved to `docs/`.**
>
> Start here: [`docs/README.md`](../docs/README.md)
>
> Key references:
> - Architecture: [`docs/platform/ARCHITECTURE.md`](../docs/platform/ARCHITECTURE.md)
> - Entities: [`docs/platform/ENTITIES.md`](../docs/platform/ENTITIES.md)
> - Auth: [`docs/platform/AUTH.md`](../docs/platform/AUTH.md)
> - API contract: [`docs/platform/API-CONTRACT.md`](../docs/platform/API-CONTRACT.md)
> - Naming: [`docs/platform/NAMING.md`](../docs/platform/NAMING.md)
> - Roadmap: [`docs/future/ROADMAP.md`](../docs/future/ROADMAP.md)
> - ADRs: [`docs/decisions/`](../docs/decisions/)
>
> Do not update this file. All documentation updates go in `docs/`.

---

## Identity (legacy — see docs/platform/ARCHITECTURE.md)
- **Type:** Multi-service platform ecosystem
- **Status:** Active — converged (Workspaces & Brands centralized in 9naŭ)
- **Last Convergence Update:** 2026-04-20

## Purpose
AI-powered personal productivity and content creation platform for solopreneurs and creators. Combines a Second Brain (9naŭ), intelligent voice assistant (Zazŭ), Instagram intelligence & Brand Registry (nauthenticity), and automated content creation (flownaŭ). All services share a platform-wide brand identity via nauthenticity as the canonical Brand Registry.

## Tech Stack
- **Primary Language:** TypeScript (Node.js)
- **Secondary:** Python (echonau — being absorbed)
- **Frameworks:** NestJS (9naŭ API), Fastify (nauthenticity), Next.js (flownaŭ, 9naŭ web), Expo/React Native (9naŭ mobile)
- **Databases:** PostgreSQL 16, Redis 7 (per-service isolation)
- **AI:** OpenAI GPT-4o, Groq Llama 3 (ideation), OpenAI Whisper
- **Infrastructure:** Docker, Traefik, Hetzner CX23, GitHub Actions
- **Media Storage:** Cloudflare R2 (Object Storage) for all assets.

## Active Services

### Core Platform Services
| Service | Domain | Status |
|---------|--------|--------|
| **nauthenticity** | **Brand Registry (SoT)**, Instagram intelligence, Brand DNA ownership, InspoBase, comment suggestion, Workspace registry | 🟢 Production |
| **9nau-api** | Second Brain backend: blocks, sync, triage, journal, search, media storage | 🟢 Production |
| **flownaŭ** | Content creation: video rendering, publishing, ideation engine (Workspace-aware, brand-linked via `nauBrandId`) | 🟢 Production |
| **zazŭ** | Telegram bot: voice journal, notifications, brand selection for voice flow | 🟢 Production |
| **whatsnau** | WhatsApp CRM & campaign orchestration | 🟢 Production |

### Product Apps
| App | Role | Status |
|-----|------|--------|
| **9nau/apps/app** | 9naŭ web application at `app.9nau.com` (formerly 'web') | 🟡 Deploying (Containerization) |
| **9nau/apps/accounts**| Central SSO identity hub at `accounts.9nau.com` | 🟡 Deploying (Containerization) |
| **9nau/apps/mobile** | 9naŭ mobile app (absorbs nau-ig) | 🟢 Production |

*Note: The marketing site (`www.9nau.com`) is purposely decoupled from the product monorepo and will live in a separate `../code/websites/9nau-web` repository to isolate its deployment pipelines.*

### Archived/Absorbed
| Project | Absorbed Into | Status |
|---------|---------------|--------|
| **komunikadoj** | 9nau/apps/api | Absorbed / Deprecated |
| **nau-ig** | 9nau/apps/mobile | Absorbed / Deprecated |
| **echonau** | 9nau/apps/api (triage module) | Absorbed / Deprecated |
| **astromatic** | flownaŭ | Absorbed / Deprecated |
| **carousel-automation** | flownaŭ | Absorbed / Deprecated |

## API Surface — 9naŭ API

> ⚠️ Routes are mounted at the **root** of `api.9nau.com`. There is no `/api/` prefix.
> e.g. `https://api.9nau.com/blocks`, NOT `api.9nau.com/api/blocks`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/blocks` | GET | List blocks (filterable by type, date, parent) |
| `/blocks` | POST | Create block |
| `/blocks/:id` | GET | Get single block with relations/children |
| `/blocks/:id` | PUT | Update block |
| `/blocks/:id` | DELETE | Soft delete block |
| `/blocks/remindable` | GET | Get blocks due for reminder |
| `/relations` | POST | Create relation between blocks |
| `/relations/:id` | DELETE | Remove relation |
| `/schedule` | POST | Upsert schedule for block |
| `/schedule/:blockId` | GET | Get schedule for block |
| `/sync/push` | POST | Push dirty blocks from client |
| `/sync/pull` | GET | Pull blocks updated since cursor |
| `/media/upload` | POST | Upload media file to Cloudflare R2 |
| `/media/:fileId` | GET | Stream/Redirect to media in Cloudflare R2 |
| `/triage` | POST | Process raw text/transcription into structured blocks + journal entry |
| `/triage/retroprocess` | POST | Admin endpoint to retroprocess accumulated `voice_capture` blocks |
| `/journal/summary` | POST | Generate AI synthesis for a given period (daily, weekly, etc.) |
| `/auth/login` | POST | User login — returns `accessToken` JWT |
| `/auth/register` | POST | User registration |
| `/auth/link-token` | POST | Generate a one-time Telegram linking token (5-minute TTL) |
| `/auth/link-token/verify` | POST | Verify a link token and bind telegramId to user (Service auth) |
| `/auth/by-telegram/:tgId` | GET | Look up a User by their telegramId (Service auth) |
| `/auth/link-telegram` | POST | Notify 9naŭ API of a completed Telegram account link (Service auth) |
| `/workspaces` | GET | List workspaces for current user |
| `/workspaces` | POST | Create workspace |
| `/workspaces/:id` | PATCH | Rename workspace |
| `/workspaces/:id/members` | GET | Get workspace members |
| `/workspaces/:id/members` | POST | Add workspace member |
| `/workspaces/:id/members/:userId` | PUT | Update member role |
| `/workspaces/:id/members/:userId` | DELETE | Remove workspace member |
| `/workspaces/:id/brands` | GET | List brands for workspace |
| `/health` | GET | Health check |

## Environment Variables — 9naŭ

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_PASSWORD` | Yes | Redis password |
| `NAU_SERVICE_KEY` | Yes | Service-to-service auth key |
| `R2_ACCESS_KEY` | Yes | Cloudflare Access Key |
| `R2_SECRET_KEY` | Yes | Cloudflare Secret Key |
| `R2_BUCKET_NAME` | Yes | Target R2 Bucket |
| `NAUTHENTICITY_URL` | No | Nauthenticity service URL (default: `http://nauthenticity:4000`) |
| `ZAZU_INTERNAL_URL` | No | Internal Zazŭ service URL (default: `http://zazu:3000`) |
| `OPENAI_API_KEY` | No* | OpenAI API Key (required for AI Triage / NLP processing) |
| `FRONTEND_URL` | No | CORS origin (default: `http://localhost:3001`) |
| `PORT` | No | API port (default: `3000`) |

\* Required for media vault features / AI features. Without these, endpoints fail or return 503.

## naŭ Platform Media Storage (Cloudflare R2)

All media is stored in Cloudflare R2 (S3-compatible). The 9naŭ API acts as a secure proxy or gives signed URLs for upload/download.

- **Vault Strategy**: Legacy Telegram Vault is abandoned. Existing files (if any) are migrated to R2.
- **Access**: Mobile app uses the API to get public/signed URLs for playback.
- **Cleanup**: `9nau-api` handles R2 bucket lifecycle and asset tagging.

### Android App Identity
- **Package:** `com.nau.ig` (preserved from nau-ig for in-place update)
- **Namespace:** `com.nau.ig`
- **Keystore:** Debug keystore at `android/app/debug.keystore` (release signing TBD — needs production keystore)
- ⚠️ **Production keystore must be the same as original nau-ig** to allow in-place OS update

## Key Decisions
- **[2026-04-22] 9naŭ API Prefix Removal**: The 9naŭ API (`api.9nau.com`) will no longer use an `/api/` global prefix. All routes will be mounted at the root (`/`), preventing redundant URLs like `api.9nau.com/api/...`. All naŭ Platform consumers (zazu, flownau, nauthenticity, 9nau web client) must target root paths for this API.
- **[2026-04-20] SSO AUTH_SECRET Alignment**: All consumer apps (`flownaŭ`, and any future web apps) **must use the same `AUTH_SECRET` as the 9naŭ API**. The 9naŭ API signs the `nau_token` JWT; consumer apps verify it. Mismatched secrets silently fail JWT verification and block all logins. Current canonical value is in `/root/9nau/.env` on the Hetzner server.
- **[2026-04-20] SSO Cookie Flow (accounts.9nau.com)**: Login at `accounts.9nau.com` sets `nau_token` cookie on `domain=.9nau.com` then redirects to `continueUrl` **without** `?token=`. Consumer app `/auth/callback` pages must check for the existing cookie (not just the URL param) and redirect to dashboard. The `?token=` URL param is reserved for a future explicit handoff flow.
- **[2026-04-20] First Instagram post published end-to-end**: Validated the full flownaŭ pipeline — all 3 ideation flows (automatic/manual/captured), composition, scheduling, Remotion render, R2 upload, and Instagram Graph API publish — in production.
- [2026-04-19] Platform Service Authorization Standard: Standardized all internal service-to-service calls to use the `x-nau-service-key` header. This separates platform-layer trust from user-layer `Authorization: Bearer <JWT>` tokens, preventing header collisions and simplifying multi-tenant orchestration.
- [2026-04-19] Universal Telegram Linking Handshake: Implemented a platform-wide OOT (One-Time Token) flow to link naŭ Accounts to Telegram. Users see a `TelegramLinkBanner` in web apps which generates a token in `9nau-api`. Redirecting to Zazŭ bot with `start=link-{token}` triggers a service-to-service verification, enabling Zazŭ to identify the global naŭ user.
- **[2026-04-18] Platform SSO UI Pattern (Google-style)**: A standardized redirection flow is implemented for all web apps. Consumer apps (flownaŭ, zazŭ) possess NO authentication forms. They display an unauthenticated UI and redirect users to `accounts.9nau.com/login?continue=<app>/auth/callback`. `accounts.9nau.com` handles the secure form, POSTs to `api.9nau.com/api/auth/login`, sets `nau_token` cookie on `.9nau.com` domain, and redirects to the `continue` URL. The `/auth/callback` page in consumer apps must handle both: (a) `?token=` param if explicitly passed, (b) existing `nau_token` cookie already set by accounts. **AUTH_SECRET must be identical across all services** — 9naŭ API signs the JWT, consumer apps verify it.
- **[2026-04-19] Universal Workspace & Brand Abstraction**: `9naŭ` is designated as the absolute IDP and structural source of truth for `Workspace`, `User`, and `Brand`. Downstream services (`flownaŭ`, `nauthenticity`, `zazŭ`) **MUST NOT** clone these structural tables. They must route their domain data using `workspaceId` and `brandId` string references. Control plane UI for Workspaces/Brands is centralized exclusively within 9naŭ.
- **[2026-04-20] Graceful Defaulting (Low-Friction Onboarding)**: Standardized platform-wide "Master Defaults" for Brand Voice, Comment Strategy, and Creative Persona. Services (`flownaŭ`, `zazŭ`, `nauthenticity`) must fallback to these defaults when specific user-provided DNA is missing. This enables "Name-Only" brand creation to reduce onboarding friction from >2 minutes to <10 seconds.
- **[2026-04-18] nauthenticity = Brand Registry SoT**: nauthenticity is the canonical source of truth for brand identity. All services reference brands by `brandId` (nauthenticity `Brand.id`). Brand DNA is owned and served by nauthenticity with full and ultra-light tiers. (Note: Under the 2026-04-19 decision, core structural "Brand" moves to 9naŭ, while nauthenticity retains "BrandIntelligence" metadata).
- **[2026-04-18] Platform Identity & SSO (9naŭ)**: 9naŭ is the IdP. It owns `User`, `Auth`, and `Workspace`. All services validate 9naŭ JWTs.
- **[2026-04-18] Canonical Naming Spec v1.0**: Enforcement of `Brand`, `Workspace`, `brandId`, `platformWorkspaceId` naming to end cross-service collisions. NextAuth dropped from flownaŭ.
- **[2026-04-18] Brand DNA Tiers**: Full Brand DNA for ideation/composition (high token), ultra-light for triage routing/comment suggestion (low token).
- **[2026-04-18] Soft Delete for Brands**: Brand deletion is soft by default (recoverable). Hard delete is explicit, cascading, and irreversible.
- **[2026-04-18] Brand Creation from Any App**: All apps can create brands via nauthenticity API. Each app injects its own linked data based on its features. (Note: As of 2026-04-19, this routes through 9naŭ API).
- **[2026-04-18] AI Brand Routing**: Voice notes processed by 9naŭ triage use ultra-light Brand DNA for AI-based brand detection. AI-linked ideas are flagged and skip auto-approve.
- **[2026-04-17] Deprecation & Absorption**: Formally deprecated legacy repositories `nau-ig`, `komunikadoj`, `echonau`, and `astromatic`. All moved to `./code/deprecated/`.
- **[2026-04-17] Cloudflare Shift**: Migrated media storage strategy from Telegram Vault to Cloudflare R2 across the platform (9naŭ + flownaŭ).
- **[2026-04-17] flownaŭ Workspace Hardening**: flownaŭ upgraded to multi-tenant Workspace architecture (Phase 9 hardened).
- **[2026-04-11] Recursive Knowledge Pyramid**: Journal summaries are now built hierarchically.
- **[2026-04-11] Synthesis-First Journaling**: Every automated review prioritizes a high-level **Synthesis** (what it means/pattern detection) followed by an objective **Summary** (what happened/facts). Daily reviews additionally include a chronological log of individual entries.
- **[2026-04-11] Periodic Journal Summaries**: Implemented a summary engine in 9naŭ API that synthesizes daily, weekly, and monthly activity into cohesive narratives using GPT-4o. Summaries are delivered via Zazŭ Proactive Delivery and saved as `journal_summary` blocks in the permanent record.
- **[2026-04-11] AI Triage in 9naŭ API**: Zazŭ intercepts voice messages natively via a high-priority skill, transcribes them, and hits `POST /api/triage`. The 9naŭ API classifies them internally using OpenAI strict structured outputs to categorize actions, projects, habits, appointments, ideas, and synthesize a journal entry. `echonau` logic is successfully fully rewritten and absorbed.
- **[2026-04-11] Content Ideation Engine**: Added an `IdeationService` in `flownau` that ingests `InspoItem` models (from `nauthenticity`), external strategy documents, and Brand DNA to generate structured content ideas (Briefs). Briefs are delivered to the user via Zazŭ and saved permanently as `journal_summary` blocks (type=content_brief) in the `9nau` API via a new `direct` summary endpoint.
- **[2026-04-11] Inspo Base Data Flow**: `InspoItem` is tracked centrally in `nauthenticity`. `9naŭ Mobile` Special Functions C (Inspo Base) and D (Replicate) now hit `nauthenticity` API to enqueue items for processing by `flownau`. Reposts (Action E) are proxied to `flownau`'s ingestion endpoint.
- **[2026-04-11] Files NOT removed from phone**: User preference — vault is cloud backup, not replacement for local storage.
- **[2026-04-10] 9naŭ Monorepo Convergence**: All Second Brain components (komunikadoj, nau-ig, echonau) converge into a single 9nau monorepo with Turborepo.
- **[2026-04-10] PostgreSQL over Obsidian**: 9naŭ uses PostgreSQL as source of truth. Obsidian export deferred.
- **[2026-04-10] Voice Triage in 9naŭ API**: AI triage logic lives in 9naŭ API, not Zazŭ.
- **[2026-04-10] InspoBase owned by nauthenticity**: IG content intelligence stays in nauthenticity domain.
- **[2026-04-10] Block-based architecture**: Everything in 9naŭ is a Block (inspired by Notion), with dynamic types and JSON properties.
- **[2026-04-10] MVP First Strategy**: Deliver complete features sequentially, not partial features in parallel.
- **[2026-04-07] nauthenticity owns all IG scraping**: Eliminates duplication.
- **[2026-04-07] flownaŭ owns all IG publishing**: Centralizes Graph API complexity.
- **[2026-04-07] Polyrepo with nau-network mesh**: Each service is standalone, connected via Docker network.

## Known Limitations
- Single Hetzner CX23 server (4GB RAM, 2 vCPU) — limited concurrent services
- Zazŭ has weak memory and identity persistence across sessions
- Telegram Bot API has 50MB upload limit for standard bots (local Bot API server can bypass this)

## naŭ Platform Dependencies Map
```
nauthenticity ←→ zazŭ (comment suggestions, brand CRUD, brand selection)
nauthenticity → flownaŭ (Brand DNA via brandId, InspoBase digest)
nauthenticity → 9naŭ-api (ultra-light Brand DNA for triage routing)
9nau-api ←→ zazŭ (voice journal, summaries, brand-tagged triage, Telegram user linking)
9nau-api → flownaŭ (content idea forwarding via /api/v1/ideas/ingest)
9nau-api ←→ 9nau/mobile (sync, media vault)
9nau-api → flownaŭ & nauthenticity (Issues JWTs for SSO auth)
flownaŭ → zazŭ (daily briefs)
flownaŭ → nauthenticity (fetch digest by brandId, fetch DNA)
```

## Cross-Service Platform Identity
```
Identity Provider:     9naŭ
Brand Source of Truth: nauthenticity Brand
Brand Reference Key:   brandId (= Brand.id)

flownaŭ.SocialAccount.brandId       → nauthenticity.Brand.id
flownaŭ.Workspace.platformWorkspaceId → 9naŭ.Workspace.id
9naŭ.Block.properties.brandId       → nauthenticity.Brand.id
zazŭ (stateless, API consumer)      → nauthenticity.Brand.id
```
 
 ## Platform Domain Knowledge: Household Management Roles
 
 ### Specialized Housekeeper
 - **Nature**: Management-level household professional.
 - **Scope**: Maintains the household through cleaning, organizing, and running errands.
 - **Capacities**: Can serve as a domestic worker, cleaner, maid, governess, or nanny.
 - **Specialized Skills**: Fine cooking, formal table settings, party planning, and child care.
 - **Leadership**: Can direct and oversee the work of other household staff.
 
 ### Estate Manager
 - **Nature**: High-level management for large-scale or multiple properties.
 - **Scope**: Responsible for the complete operations of one or more estates.
 - **Focus**: Strategic property handling, logistics, and ensuring owner needs are met across all locations.
 - **Expertise**: Requires knowledge of legal/business aspects of property management, and often agricultural or corporate management skills.
 - **Integration**: Works as the primary liaison between owners and the full estate staff.
 
 ### Executive Housekeeper
 - **Nature**: Managerial housekeeper for massive households.
 - **Scope**: Organizes and runs large-scale households with multiple staff members.
 - **Mindset**: Operates the household with a corporate/business efficiency model.
 - **Mobility**: Often manages multiple households for a single family to ensure consistent standards across locations.
