# ECOSYSTEM ARCHITECTURE PLAN
## The NAÅ¬ Platform â€” Unified Service Mesh

> **Architecture Mandate:** Domain ownership over integration convenience. Every service knows what it owns, and never what it shouldn't.

---

## A. Project Constraints & Implementation Principles

### Hard Boundaries
- **Domain Sovereignty**: A capability belongs to exactly ONE service. Cross-service duplication is a zero-tolerance architectural violation.
- **API-First Integration**: Services communicate exclusively via authenticated HTTP APIs or async event queues. Direct DB access across service boundaries is prohibited.
- **nau-network Network**: All Dockerized services participate in the existing `nau-network` Traefik network. No public exposure is required for internal calls.
- **No Breaking Changes**: Integration must be additive. Existing functionality in each repo must not regress during the integration rollout.
- **Auth Between Services**: All inter-service API calls use a shared bearer token (`NAU_SERVICE_KEY`) scoped per service pair. No unauthenticated internal endpoints.
- **Graceful Degradation**: Every consumer of a platform service must handle 503/timeout gracefully. Queued retry is the default pattern.

### Core Architecture Principles
- **Three-Layer Model**: Platform Services â†’ Product Apps â†’ Orchestration/Glue.
- **Event-Driven Async for Media Flows**: Any pipeline step that takes >500ms uses BullMQ/Redis queues, not synchronous HTTP.
- **REST for CRUD, Events for Pipelines**: Simple data reads/writes use REST. Long-running workflows use events.
- **Additive Phase Rollout**: We integrate one domain at a time, starting with the highest-friction / most-duplicated ones.

---

## B. Ecosystem Identity

**Name:** NAÅ¬ Platform  
**Type:** Distributed Monorepo Ecosystem (Poly-repo with Shared Mesh)  
**Topology:** Multi-service, Docker Compose orchestrated, Traefik gateway  
**Environment:** Hetzner VPS (production), Windows/WSL (local dev)

### Shared Infrastructure Stack
| Component | Technology | Role |
|-----------|-----------|------|
| Gateway | Traefik v2 | DNS routing, SSL termination, `nau-network` network hub |
| Shared Auth | Bearer token (`NAU_SERVICE_KEY`) | Service-to-service authentication |
| Queue | BullMQ + Redis | Async event-driven pipelines |
| Storage | Cloudflare R2 | Binary asset object storage (all services) |
| Transcription | Whisper (Docker Container) | Audio-to-text, shared via HTTP |
| Scraping | Apify (external) | Instagram post & profile data |

---

## C. Architectural Blueprint â€” The Three Layers

### Layer 1: Platform Services (Headless Domain Owners)

These services own a capability completely. They expose REST APIs. They have no product UI coupled to domain logic.

| Service | Domain Ownership | Capabilities | Status |
|---------|-----------------|--------------|--------|
| **`flownau`** | Media & Publishing | Video rendering (Remotion), Instagram Graph API publishing, R2 asset management, content scheduling | Active â€” needs API hardening |
| **`nauthenticity`** | Content Intelligence | IG account scraping (Apify), media transcription pipeline, AI enrichment, vector embeddings, RAG query | Active â€” needs API exposure |
| **`whatsnau`** | WhatsApp CRM | WhatsApp campaign orchestration, multi-tenant lead management, AI agent dispatch, human handover | Active â€” standalone, self-contained |
| **`whisper-service`** | Audio Transcription | REST HTTP wrapper over Whisper ASR. Input: audio file â†’ Output: transcript JSON | Active â€” needs discovery by other services |
| **`komunikadoj`** | 9NAÅ¬ App Backend | NestJS CRUD backend for the 9NAÅ¬ platform. User/content model | Active â€” minimal, needs expansion |
| **`web-chatbot-widget`** (KarenBot) | Conversational RAG | Embeddable chatbot widget, semantic search over 5k+ posts, lead capture | Active â€” standalone |

### Layer 2: Product Apps (User-Facing, Orchestrate Platform Services)

These services own NO domain capabilities. They orchestrate platform services to deliver user experience.

| App | Users | Platform Services Used | Migration Needed |
|-----|-------|----------------------|-----------------|
| **`nau-ig`** (mobile + web) | Creators | nauthenticity (scraping), flownau (publishing), whisper-service (transcription) | HIGH â€” currently has own Apify integration duplicating nauthenticity |
| **`andi-universo`** | Clients (mothers) | None â€” standalone product | LOW |
| **`samuelaure-web`** | Public | None â€” static/personal site | LOW |
| **`karenexplora-web`** | Karen's audience | web-chatbot-widget (embed) | LOW |
| **`topic-roulette`** | Creators | None currently | LOW |
| **`math-app`** | Children | None â€” offline-first | NONE |

### Layer 3: Orchestration / Glue

These are automation engines. They chain platform services together without owning domain data.

| Service | Role | Integration Points |
|---------|------|--------------------|
| **`zazu`** | Telegram bot gateway, personal automation hub, skills dispatcher | flownau (publishing commands), nauthenticity (content queries), echonau (voice), whatsnau (CRM alerts) |
| **`echonau`** | Local voice transcription pipeline | flownau (content ingest via `POST /api/content/ingest`) |
| **`n8n-local`** | Visual workflow automation | Webhooks into any platform service |
| **`apify-actors`** | Custom Apify actor code | Feeds nauthenticity ingestion pipeline |
| **`carrousel-automation`** | Headless carousel image generator | Invoked by flownau rendering pipeline |

---

## D. Domain Ownership Conflicts â€” Diagnosed

### ðŸ”´ CRITICAL: Instagram Scraping â€” Duplicated
- **Problem:** Both `nau-ig` (`ApifyService.ts`, `SyncManager.ts`) and `nauthenticity` (`apify.service.ts`) independently call Apify to scrape Instagram posts. Two independent implementations of the same domain capability.
- **Owner:** `nauthenticity` owns "Instagram content ingestion."
- **Resolution:** `nau-ig` must call `nauthenticity`'s ingestion API instead of Apify directly. `nau-ig` keeps its local SQLite capture model but delegates all IG data fetching to `nauthenticity`.

### ðŸ”´ CRITICAL: Instagram Publishing â€” Needs Formalization
- **Problem:** `flownau` has Instagram Graph API publishing capability embedded inside Next.js route handlers (not yet a clean REST API). `nau-ig` is planning to add publishing â€” it must NOT implement this itself.
- **Owner:** `flownau` owns "publishing to Instagram."
- **Resolution:** Extract flownau's publishing logic into a formal REST API (`POST /api/v1/publish`). `nau-ig`'s backend calls this endpoint.

### ðŸŸ¡ MODERATE: Audio Transcription â€” Fragmented
- **Problem:** `echonau` uses `faster-whisper` locally (Python). `nauthenticity` has its own `transcription.service.ts`. `whisper-service` is a Docker container running HTTP Whisper but only used by `infrastructure`.
- **Owner:** `whisper-service` owns "audio-to-text transcription." Both `echonau` and `nauthenticity` should call it.
- **Resolution:** Phase 2 â€” migrate both callers to use `whisper-service` REST API.

### ðŸŸ¡ MODERATE: Apify Scraping â€” Redundant Configuration
- **Problem:** Both `nau-ig` and `nauthenticity` store Apify API tokens separately in their own `.env`. `flownau` also uses Apify (`apify-actors`).
- **Resolution:** Apify token becomes a `nauthenticity` configuration item only. All other services call nauthenticity's API to get scraped data.

### ðŸŸ¡ MODERATE: `nau-ig` â€” Architecture Transition Required
- **Problem:** `nau-ig` is currently a mobile-only app with local SQLite. The user intends to move it to a backend + web client. During this transition, the architecture of the backend is critical.
- **Resolution:** `nau-ig`'s new backend is a Product App backend â€” thin API layer that orchestrates nauthenticity (scraping) and flownau (publishing). SQLite stays on mobile as offline cache. Backend uses Postgres.

### ðŸŸ¢ LOW: `zazu` Skills â€” No API Contract
- **Problem:** Zazu has a plug-and-play skill architecture but skills that need cross-service API calls have no formalized way to discover service endpoints or authenticate.
- **Resolution:** Phase 3 â€” Zazu reads `NAU_SERVICE_REGISTRY` from env to resolve service URLs. Skills call platform service APIs with `NAU_SERVICE_KEY`.

---

## E. Inter-Service API Contracts (Proposed)

### `nauthenticity` Internal API (to be formalized)
```
POST /api/v1/scrape/post         â€” Scrape a single IG post URL (replaces nau-ig's ApifyService)
POST /api/v1/scrape/profile      â€” Scrape an IG profile
POST /api/v1/ingest/batch        â€” Bulk ingest by username
GET  /api/v1/content/search      â€” RAG vector search over stored content
GET  /api/v1/content/:postId     â€” Get enriched post by ID
```

### `flownau` Internal API (to be formalized)
```
POST /api/v1/publish             â€” Publish media to a linked Instagram account
GET  /api/v1/accounts            â€” List linked social accounts
POST /api/v1/render              â€” Trigger a video render job
GET  /api/v1/render/:renderId    â€” Poll render job status
POST /api/v1/assets/upload       â€” Upload a raw asset to R2
```

### `whisper-service` (already HTTP, needs documentation)
```
POST /asr                        â€” Submit audio blob â†’ returns transcript JSON
```

### `whatsnau` (self-contained, no downstream consumers currently)
- Exposes webhooks for incoming WhatsApp messages from Meta/YCloud.
- No required integration with other NAÅ¬ services today.

---

## F. Shared Infrastructure Strategy

### Docker Network
All services attach to the existing `nau-network` external Docker network managed by Traefik (`infrastructure/docker-compose.yml`).

Inter-service calls use container names as hostnames:
```
http://nauthenticity:3000/api/v1/scrape/post
http://flownau:3000/api/v1/publish
http://whisper-service:9000/asr
```

### Service Authentication
```env
# Each service has this in its .env:
NAU_SERVICE_KEY=<shared_secret_rotated_per_environment>

# Each service verifies inbound requests:
Authorization: Bearer <NAU_SERVICE_KEY>
```

### Port Registry (Local Dev â€” Deterministic)
| Service | External Port | Internal Port |
|---------|--------------|---------------|
| Traefik | 80, 443, 8080 | â€” |
| flownau | 3001 | 3000 |
| nauthenticity | 3002 | 3000 |
| whatsnau backend | 3003 | 3000 |
| whatsnau frontend | 5173 | 5173 |
| komunikadoj | 3004 | 3000 |
| zazu bot | 3005 | 3000 |
| nau-ig backend (new) | 3006 | 3000 |
| whisper-service | 9000 | 9000 |
| shared postgres | â€” | 5432 (internal) |
| shared redis | â€” | 6379 (internal) |

---

## G. Execution Roadmap

### PHASE 0 â€” Foundation & Authz (Current)
**Goal:** Establish the nau-network auth protocol and document existing API surfaces. No product changes.
- Define `NAU_SERVICE_KEY` across all active services (env-level only).
- Write OpenAPI stubs for `nauthenticity` and `flownau` intended public APIs.
- Create a `SERVICE_MAP.md` in this `.agent/` directory as the living network map.

### PHASE 1 â€” Eliminate Instagram Scraping Duplication
**Goal:** `nau-ig` stops calling Apify directly. It calls `nauthenticity` instead.
- Harden `nauthenticity` ingestion API with auth middleware.
- `nau-ig` new backend calls `POST /api/v1/scrape/post` (nauthenticity).
- `nau-ig` existing mobile app `ApifyService.ts` is deprecated â†’ `NauthenticityService.ts`.
- Verification: No Apify token in `nau-ig` `.env`.

### PHASE 2 â€” Formalize Instagram Publishing API in `flownau`
**Goal:** `flownau`'s publishing becomes a first-class REST API that `nau-ig` and future consumers can call.
- Extract IG publishing out of Next.js route handlers into a service module.
- Expose `POST /api/v1/publish` with `NAU_SERVICE_KEY` auth.
- `nau-ig`'s backend calls flownau to publish captured posts.
- Verification: `nau-ig` can trigger a publish to Instagram without any IG Graph API token.

### PHASE 3 â€” `nau-ig` Backend Architecture (New Service)
**Goal:** `nau-ig` gets a proper Node.js/Express backend. Mobile and web share the same API.
- Thin backend: Postgres for persistence, orchestrates nauthenticity + flownau.
- Remove SQLite from mobile (or keep as offline cache only, sync to backend on connect).
- Web client: React/Vite.
- Verification: Mobile app and web app show same data from shared backend.

### PHASE 4 â€” Whisper Consolidation
**Goal:** Single transcription endpoint. No more duplicated Whisper logic.
- `nauthenticity` transcription service calls `whisper-service` HTTP API.
- `echonau` (Python) calls `whisper-service` HTTP API instead of local `faster-whisper`.
- Verification: `whisper-service` is the single running Whisper process.

### PHASE 5 â€” Zazu Service Mesh Integration
**Goal:** Zazu gains the ability to call platform services via authenticated APIs.
- Zazu env gains `SERVICE_REGISTRY` (JSON map of service â†’ URL).
- New Zazu skill: `publish-to-ig` â†’ calls flownau.
- New Zazu skill: `search-content` â†’ calls nauthenticity.
- Verification: Telegram command triggers a flownau publish via Zazu.

---

## H. What We Are NOT Doing (Anti-Overengineering Directive)

âŒ **No service mesh proxy (Istio, Linkerd)**: Docker network + Traefik is sufficient at this scale.  
âŒ **No Kafka or RabbitMQ**: BullMQ/Redis is already in use by flownau and nauthenticity. That's the queue.  
âŒ **No API Gateway microservice**: Traefik handles routing.  
âŒ **No shared database**: Each service owns its own database schema. No cross-DB joins.  
âŒ **No monorepo migration**: The poly-repo structure works. We add integration APIs, not merge repos.  
âŒ **No gRPC**: REST is sufficient. gRPC adds complexity with no marginal benefit at this scale.  
âŒ **No Kubernetes**: Single Hetzner VPS + Docker Compose is the correct infrastructure for the current load.

# PHASE 0 â€” Foundation: Service Mesh Auth & API Documentation

## Objectives
Establish the authentication protocol for inter-service communication and document the current API surface of each Platform Service. This is the "pre-integration" phase. No product code is changed. It is entirely additive.

**WHY THIS FIRST:** We cannot integrate anything until we know what each service currently exposes and how services will verify they're talking to each other. Skipping this phase leads to ad-hoc token management chaos as soon as Phase 1 begins.

---

## Tasks

### 0.1 â€” Define `NAU_SERVICE_KEY` Auth Protocol

- [ ] Choose a single shared secret format: `NAU_SERVICE_KEY=nau_sk_<base64_random_48bytes>`
- [ ] Generate a development key: `openssl rand -base64 48 | tr -d '\n'`
- [ ] Add `NAU_SERVICE_KEY` to `flownau/.env.example`
- [ ] Add `NAU_SERVICE_KEY` to `nauthenticity/.env.example`
- [ ] Add `NAU_SERVICE_KEY` to `whatsnau/.env.example`
- [ ] Add `NAU_SERVICE_KEY` to `komunikadoj/.env.example`
- [ ] Add `NAU_SERVICE_KEY` to `zazu/.env.example`
- [ ] Add `NAU_SERVICE_KEY` to `echonau/.env` (Python)
- [ ] Document rotation procedure in this file's footnotes.

**Verification:** Every active Platform Service `.env.example` has `NAU_SERVICE_KEY=`.

---

### 0.2 â€” Service URL Registry

- [ ] Create `.agent/SERVICE_REGISTRY.md` with the following table:

| Service | Local URL (via Docker hostname) | Local URL (via port) | Production URL |
|---------|-------------------------------|---------------------|----------------|
| `flownau` | `http://flownau:3000` | `http://localhost:3001` | `https://flownau.9nau.com` |
| `nauthenticity` | `http://nauthenticity:3000` | `http://localhost:3002` | `https://nauthenticity.9nau.com` |
| `whatsnau` (backend) | `http://whatsnau-backend:3000` | `http://localhost:3003` | `https://whatsnau.9nau.com` |
| `komunikadoj` | `http://komunikadoj:3000` | `http://localhost:3004` | `https://api.9nau.com` |
| `zazu` | `http://zazu:3000` | `http://localhost:3005` | `https://zazu.9nau.com` |
| `nau-ig` backend | `http://nau-ig-api:3000` | `http://localhost:3006` | `https://api.nau-ig.com` |
| `whisper-service` | `http://whisper:9000` | `http://localhost:9000` | local only |
| `web-chatbot-widget` | `http://karenbot:3000` | `http://localhost:3007` | `https://karenbot.9nau.com` |

- [ ] Add `NAU_SERVICE_REGISTRY` env var to each service's `.env.example` as a JSON string pointing to the above registry (or comma-separated key=value pairs).

---

### 0.3 â€” Audit Existing API Surfaces

For each Platform Service, document what HTTP endpoints currently exist:

#### `nauthenticity` (Fastify, port 3000)
- [ ] Read `src/app.ts` and all controller files
- [ ] List all routes: method, path, auth, purpose
- [ ] Record in `.agent/API_SURFACE_NAUTHENTICITY.md`

#### `flownau` (Next.js App Router, port 3000)
- [ ] Read all files under `src/app/api/`
- [ ] List all routes: method, path, auth, purpose
- [ ] Record in `.agent/API_SURFACE_FLOWNAU.md`

#### `komunikadoj` (NestJS, port 3000)
- [ ] Read `src/app.module.ts` and all controllers
- [ ] Record in `.agent/API_SURFACE_KOMUNIKADOJ.md`

#### `whatsnau` (Node ESM, port 3000)
- [ ] Read `packages/backend/src/index.ts`
- [ ] Record in `.agent/API_SURFACE_WHATSNAU.md`

**Verification:** 4 `API_SURFACE_*.md` files exist in `.agent/`.

---

### 0.4 â€” Identify Duplicate Apify Token Usage

- [ ] Run: `grep -r "apify" --include="*.env*" --include="*.env.example" c:/Users/Sam/code/ -l`
- [ ] Record all repos that independently store an Apify token.
- [ ] Result expected: `nau-ig`, `nauthenticity`, `flownau` (possibly).
- [ ] Document in `.agent/DUPLICATION_AUDIT.md` with severity and proposed owner.

---

### 0.5 â€” Identify Duplicate Whisper/Transcription Usage

- [ ] List all repos with `whisper` or `transcription` references in their source files.
- [ ] Result expected: `echonau`, `nauthenticity`, `whisper-service` (Docker).
- [ ] Document in `.agent/DUPLICATION_AUDIT.md`.

---

### 0.6 â€” Create `DUPLICATION_AUDIT.md`

The complete register of all domain capability duplication found across the ecosystem.

- [ ] Create `.agent/DUPLICATION_AUDIT.md`
- [ ] For each conflict: name the conflicting repos, the capability, the designated owner, and the migration path.
- [ ] Template per row:

```
| Capability | Repos with duplicate impl | Designated Owner | Migration |
|-----------|--------------------------|-----------------|-----------|
| Instagram Post Scraping | nau-ig, nauthenticity | nauthenticity | Phase 1 |
| Audio Transcription | echonau, nauthenticity | whisper-service | Phase 4 |
| Apify Token | nau-ig, nauthenticity, flownau | nauthenticity | Phase 1 |
```

---

## Verification Criteria

Phase 0 is complete when:

1. âœ… `NAU_SERVICE_KEY` is defined in every active platform service's `.env.example`.
2. âœ… `.agent/SERVICE_REGISTRY.md` exists with all service URLs documented.
3. âœ… 4 `API_SURFACE_*.md` files exist documenting current routes.
4. âœ… `.agent/DUPLICATION_AUDIT.md` exists with all conflicts catalogued.
5. âœ… Zero code changes were made to any production service.

---

## Footnotes â€” `NAU_SERVICE_KEY` Rotation Procedure

1. Generate new key: `node -e "console.log('nau_sk_' + require('crypto').randomBytes(48).toString('base64'))"`
2. Update `.env` on all running services in production (rolling update, not simultaneous).
3. Restart services one at a time to avoid auth failures during rotation.
4. Future: consider a short dual-key validation window.

# PHASE 1 â€” Eliminate Instagram Scraping Duplication

## Objectives
`nau-ig` must stop calling Apify directly. All Instagram post scraping is delegated to `nauthenticity`. This eliminates the #1 domain ownership violation in the ecosystem.

**Pre-condition:** Phase 0 complete. `NAU_SERVICE_KEY` defined. `API_SURFACE_NAUTHENTICITY.md` exists.

---

## Context: What Exists Today

### `nau-ig` (mobile app only, currently)
- `src/services/ApifyService.ts` â€” Direct Apify API caller. Scrapes IG posts and profiles.
- `src/services/SyncManager.ts` â€” Background sync engine that calls `ApifyService` for pending posts.
- `src/services/MediaCacheService.ts` â€” Downloads and caches media locally.
- Data stored in local SQLite.

### `nauthenticity` (backend service)
- `src/services/apify.service.ts` â€” Independent Apify caller for bulk profile ingestion.
- `src/modules/ingestion/ingester.ts` â€” Queue-based ingestion pipeline.
- Stores enriched posts in Postgres + vector DB.
- Currently has NO documented external API for single-post scraping.

### The Problem
`nau-ig` implements its own scraping because when it was built, no shared scraping service existed. That service now exists (`nauthenticity`). The duplication must be eliminated.

---

## Tasks

### 1.1 â€” Add `POST /api/v1/scrape/post` to `nauthenticity`

- [ ] Create `src/modules/ingestion/scrape.controller.ts` in `nauthenticity`
- [ ] Implement `POST /api/v1/scrape/post` endpoint:
  - **Request body:** `{ url: string }` â€” a single Instagram post URL
  - **Auth:** `Authorization: Bearer <NAU_SERVICE_KEY>` (middleware)
  - **Logic:** calls the existing `ApifyService.scrapPost()` (already in nauthenticity's `apify.service.ts`)
  - **Response:** `{ status, postId, username, caption, mediaItems: [{ type, url, storageUrl }] }`
  - **Behavior:** idempotent â€” if post URL already in DB, return existing record without re-scraping

- [ ] Add auth middleware `src/infrastructure/auth.middleware.ts` that validates `NAU_SERVICE_KEY`
- [ ] Register route in `src/app.ts`
- [ ] Write at minimum 1 integration test for the endpoint

### 1.2 â€” Add `POST /api/v1/scrape/profile` to `nauthenticity`

- [ ] Implement `POST /api/v1/scrape/profile` endpoint:
  - **Request body:** `{ username: string }`
  - **Auth:** same `NAU_SERVICE_KEY` middleware
  - **Logic:** calls `ApifyService.fetchProfileInfo()` (already exists)
  - **Response:** `{ status, id, username, profileImage }`

### 1.3 â€” `nauthenticity`: Add `NAU_SERVICE_KEY` to `.env.example`

- [ ] Add `NAU_SERVICE_KEY=` to `nauthenticity/.env.example`
- [ ] Load it in the auth middleware from `process.env.NAU_SERVICE_KEY`
- [ ] Add validation on startup: service refuses to start if `NAU_SERVICE_KEY` is not set in production (`NODE_ENV=production`)

### 1.4 â€” `nau-ig`: Create `NauthenticityClient.ts`

This is the replacement for `ApifyService.ts` in nau-ig.

- [ ] Create `src/services/NauthenticityClient.ts` in `nau-ig`
- [ ] Implement:
  ```typescript
  class NauthenticityClient {
    static async scrapePost(instagramUrl: string): Promise<ScrapeResult>
    static async fetchProfile(username: string): Promise<ProfileResult>
  }
  ```
- [ ] Read `NAUTHENTICITY_API_URL` and `NAU_SERVICE_KEY` from app config/env
- [ ] Map nauthenticity response to the same internal types that `ApifyService` returned (no `SyncManager.ts` changes)
- [ ] The client must handle: 503 (service unavailable), timeout â†’ return `{ status: 'error' }` gracefully

### 1.5 â€” `nau-ig`: Update `SyncManager.ts` to use `NauthenticityClient`

- [ ] In `SyncManager.ts`, replace `ApifyService.scrapPost()` calls with `NauthenticityClient.scrapePost()`
- [ ] Replace `ApifyService.fetchProfileInfo()` calls with `NauthenticityClient.fetchProfile()`
- [ ] Remove the `apify_api_token` setting lookup from `SyncManager` (no longer needed)
- [ ] Verify: `SyncManager` no longer imports `ApifyService`

### 1.6 â€” `nau-ig`: Deprecate `ApifyService.ts`

- [ ] Add `@deprecated` JSDoc comment to `ApifyService` class: "Use NauthenticityClient instead. Will be removed in next version."
- [ ] Do NOT delete yet â€” wait for E2E verification.

### 1.7 â€” `nau-ig`: Remove Apify Token from Config

- [ ] Remove `APIFY_TOKEN` from `nau-ig`'s `.env.example`
- [ ] Add `NAUTHENTICITY_API_URL=http://nauthenticity:3000` to `nau-ig`'s `.env.example`
- [ ] Add `NAU_SERVICE_KEY=` to `nau-ig`'s `.env.example`

### 1.8 â€” `nau-ig`: Update Settings Repository

- [ ] In `src/repositories/SettingsRepository` (or equivalent), replace `apify_api_token` setting lookup
- [ ] Settings no longer need to store Apify credentials

### 1.9 â€” Integration Test: End-to-End Scrape Flow

- [ ] With both `nauthenticity` and `nau-ig` running locally (`nau-network` network):
  - Add a test IG post URL in `nau-ig` UI
  - Verify `SyncManager` calls `NauthenticityClient`
  - Verify `NauthenticityClient` calls `nauthenticity` API
  - Verify IG post data returns and is stored in `nau-ig`'s local DB
  - Verify `ApifyService` is NOT called

### 1.10 â€” Delete `ApifyService.ts` from `nau-ig`

- [ ] After E2E verification passes, delete `src/services/ApifyService.ts` from `nau-ig`
- [ ] Confirm no remaining imports of `ApifyService` in `nau-ig` codebase

---

## Verification Criteria

Phase 1 is complete when:

1. âœ… `nauthenticity` has `POST /api/v1/scrape/post` and `POST /api/v1/scrape/profile` with auth.
2. âœ… `nau-ig` has `NauthenticityClient.ts` and `ApifyService.ts` is deleted.
3. âœ… `nau-ig` `.env.example` has no `APIFY_TOKEN`, has `NAUTHENTICITY_API_URL`.
4. âœ… E2E scrape flow works via `nauthenticity` proxy.
5. âœ… `grep -r "apify_api_token" nau-ig/src` returns 0 results.

---

## Risk & Degradation Strategy

**Risk:** `nauthenticity` is unavailable.  
**Response:** `NauthenticityClient` returns `{ status: 'error' }`. `SyncManager` treats this as a failed sync attempt â€” the post stays in `PENDING` state and retries on next sync cycle.  
**Impact:** No immediate user-facing failure. The post capture UI still works; the sync just queues.

# PHASE 2 â€” Formalize Instagram Publishing API in `flownau`

## Objectives
`flownau`'s Instagram publishing capability, currently embedded in Next.js route handlers, is extracted into a clean, authenticated REST API. `nau-ig` and any future consumer can trigger publishing via `POST /api/v1/publish` without ever touching the Instagram Graph API directly.

**Pre-condition:** Phase 1 complete.

---

## Context: What Exists Today in `flownau`

### Publishing Logic Location
- `src/modules/accounts/instagram.ts` â€” Instagram Graph API integration (exists, has account-linking logic)
- `src/modules/accounts/actions.ts` (8.4KB) â€” Server actions for account management
- `src/app/api/` routes â€” Various Next.js API routes (render, compose, schedule, publish)
- `src/modules/video/agent.ts` â€” Publishing logic possibly mixed with rendering

### The Problem
The Instagram publishing capability is tightly coupled to Next.js server actions and App Router handlers. It requires session-based authentication (NextAuth) making it only callable from the flownau UI, not from other services. It needs to be separated into a service-level API.

---

## Tasks

### 2.1 â€” Audit Current Publishing Code

- [ ] Read `src/modules/accounts/instagram.ts` fully â€” map all Graph API calls
- [ ] Read `src/modules/video/agent.ts` â€” identify publishing-related code
- [ ] Read all routes under `src/app/api/render/`, `src/app/api/schedule/` â€” note what triggers publishing
- [ ] Document the publishing flow in `.agent/FLOWNAU_PUBLISH_FLOW.md`:
  - What data is required to publish? (media URL, caption, account ID)
  - Which Instagram Graph API endpoints are called?
  - What is the current auth model (which user/token is used)?

### 2.2 â€” Design the `POST /api/v1/publish` Endpoint

**Request schema:**
```typescript
{
  accountId: string;       // flownau SocialAccount ID
  mediaUrl: string;        // R2 URL of the rendered video/image
  caption: string;
  mediaType: 'REELS' | 'IMAGE' | 'CAROUSEL';
  callbackUrl?: string;    // Optional: nauthenticity/nau-ig can receive publish result
}
```

**Auth:** `Authorization: Bearer <NAU_SERVICE_KEY>` â€” NOT NextAuth session.

**Response:**
```typescript
{
  jobId: string;           // Internal publish job ID
  status: 'QUEUED' | 'PUBLISHED' | 'FAILED';
  instagramMediaId?: string;
  instagramPermalink?: string;
  error?: string;
}
```

**Behavior:**
- Validate `NAU_SERVICE_KEY`.
- Validate `accountId` exists and has a valid (non-expired) access token.
- If `mediaType=REELS` or large file: queue job async via BullMQ â†’ return `QUEUED` with `jobId`.
- If small image: attempt synchronous publish â†’ return `PUBLISHED`.
- Store result in `Render` table (`instagramMediaId`, `instagramStatus`).

- [ ] Write the endpoint design to `.agent/FLOWNAU_PUBLISH_FLOW.md`

### 2.3 â€” Create `src/modules/publishing/` in `flownau`

This is the extraction of the publish domain into a pure service module.

- [ ] Create `src/modules/publishing/publishing.service.ts`:
  - `publishToInstagram(accountId, mediaUrl, caption, mediaType): Promise<PublishResult>`
  - This is a pure function â€” no HTTP concerns, just calls the IG Graph API.
  - Moved from wherever it currently lives (accounts/instagram.ts or video/agent.ts).

- [ ] Create `src/modules/publishing/publishing.queue.ts`:
  - BullMQ worker that processes async publish jobs.
  - On completion: updates `Render.instagramStatus` in DB.
  - On failure: retries up to 3 times with exponential backoff.

- [ ] Create `src/modules/publishing/publishing.validator.ts`:
  - Validates `accountId` exists.
  - Validates access token is not expired.
  - Returns `{ valid: boolean, reason?: string }`.

### 2.4 â€” Create `src/app/api/v1/publish/route.ts` in `flownau`

- [ ] Create `POST /api/v1/publish` route handler.
- [ ] Apply `NAU_SERVICE_KEY` auth middleware (create `src/lib/service-auth.ts` if not exists).
- [ ] Call `publishing.validator.ts` â†’ reject with 422 if invalid.
- [ ] Call `publishing.service.ts` (direct) or `publishing.queue.ts` (async) based on media type.
- [ ] Return the designed response schema.

### 2.5 â€” Create `GET /api/v1/publish/:jobId` in `flownau`

- [ ] Implement status polling endpoint.
- [ ] Returns current status from `Render` table.
- [ ] Auth: same `NAU_SERVICE_KEY`.

### 2.6 â€” Create `GET /api/v1/accounts` in `flownau`

This allows `nau-ig` to ask flownau: "which Instagram accounts are available to publish to?"

- [ ] Implement `GET /api/v1/accounts`.
- [ ] Returns: `[ { id, username, platform, profileImage } ]` â€” no access tokens in response.
- [ ] Auth: `NAU_SERVICE_KEY`.

### 2.7 â€” `nau-ig`: Create `FlownauClient.ts`

- [ ] Create `src/services/FlownauClient.ts` in `nau-ig` backend (or future backend):
  ```typescript
  class FlownauClient {
    static async publishPost(accountId, mediaUrl, caption, mediaType): Promise<PublishResult>
    static async getPublishStatus(jobId: string): Promise<PublishStatus>
    static async listAccounts(): Promise<SocialAccount[]>
  }
  ```
- [ ] Read `FLOWNAU_API_URL` and `NAU_SERVICE_KEY` from env.
- [ ] Graceful degradation: if flownau is unreachable, return `{ status: 'QUEUED_LOCAL' }` and store intent in local DB for retry.

### 2.8 â€” Integration Test: End-to-End Publish Flow

- [ ] With both `flownau` and `nau-ig` running on `nau-network`:
  - `nau-ig` UI: select a captured post, tap "Publish to Instagram".
  - `nau-ig` backend calls `FlownauClient.publishPost()`.
  - Verify `flownau` receives the request, validates auth, queues the job.
  - Verify IG Graph API is called from `flownau` only.
  - Verify `nau-ig` UI shows publish status via polling.

### 2.9 â€” Harden Old Publishing Paths (Optional, Phase 2.5)

- [ ] Existing internal flownau dashboard publishing continues to work via the same `publishing.service.ts`.
- [ ] Remove any publishing logic that no longer has a single canonical call path.
- [ ] Ensure no IG Graph API calls remain in Next.js page-level code.

---

## Verification Criteria

Phase 2 is complete when:

1. âœ… `flownau` has `POST /api/v1/publish`, `GET /api/v1/publish/:jobId`, `GET /api/v1/accounts` â€” all authenticated.
2. âœ… `nau-ig` has `FlownauClient.ts` that calls flownau.
3. âœ… `nau-ig` has no Instagram Graph API token in its `.env` or code.
4. âœ… E2E publish flow works: `nau-ig` â†’ `flownau` â†’ Instagram.
5. âœ… `grep -r "graph.facebook.com" nau-ig/src` returns 0 results.

---

## Risk & Degradation Strategy

**Risk:** `flownau` is unavailable at publish time.  
**Response:** `FlownauClient` returns `{ status: 'QUEUED_LOCAL' }`. `nau-ig` stores a `pending_publish` record in its local DB. A background worker retries periodically. The user sees "Publishing queued" in the UI.  
**Secondary Risk:** Instagram token is expired in `flownau`.  
**Response:** Publishing fails with clear error â†’ `flownau` sets `instagramStatus: 'AUTH_REQUIRED'` and notifies admin via Telegram (Zazu integration opportunity).

# PHASE 3 â€” `nau-ig` Backend: Architecture Transition

## Objectives
`nau-ig` transitions from a mobile-only, local SQLite app to a client-server architecture. A new thin Node.js backend serves both the existing mobile app and a new web client. All data is persisted on the server (Postgres). The mobile app retains SQLite as an offline cache only.

**Pre-condition:** Phases 1 and 2 complete. `NauthenticityClient` and `FlownauClient` exist.

---

## Context: Architectural Decision

### Why a thin backend (not a full NestJS monolith)?
`nau-ig`'s role is a **Product App** â€” it orchestrates Platform Services. Its backend should be as thin as possible:
- Express + TypeScript (not NestJS â€” no decorator complexity for a thin orchestrator)
- Prisma + Postgres for server persistence
- No heavy business logic â€” all domain logic lives in nauthenticity (scraping) or flownau (publishing)
- Offline-first mobile: SQLite remains as a local cache, synced to server when connected

### Technology Decision
- **Backend:** Node.js, Express, TypeScript, Prisma (Postgres)
- **Web Client:** React + Vite (consistent with existing nau-ig mobile which is Expo/React Native)
- **Mobile:** Existing Expo React Native app â€” API switched to call this new backend instead of SQLite directly (or SQLite acts as write-ahead cache only)
- **Auth:** JWT (same pattern as whatsnau)

---

## Tasks

### 3.1 â€” Design the `nau-ig` Backend Data Model

- [ ] Design Prisma schema in `nau-ig/backend/prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  captures  Capture[]
  profiles  TrackedProfile[]
}

model Capture {
  id                 String   @id @default(cuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id])
  instagramUrl       String
  syncStatus         String   @default("PENDING") // PENDING, SYNCED, RESTRICTED, FAILED
  caption            String?
  username           String?
  profileImage       String?
  mediaItems         Json?    // [{ type, url, storageUrl }]
  tags               String[] // Array of tag slugs
  notes              String?
  smRepetitionData   Json?    // SM-2 spaced repetition state
  publishStatus      String?  // NULL, QUEUED, PUBLISHED, FAILED
  flownauJobId       String?  // Links to flownau publish job
  nauthenticityId    String?  // Links to nauthenticity post ID
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}

model TrackedProfile {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  username  String
  profileImage String?
  addedAt   DateTime @default(now())
}
```

- [ ] Review against existing mobile SQLite schema â€” ensure migration path is viable.

### 3.2 â€” Scaffold `nau-ig` Backend

Create the backend as a sub-directory in the existing `nau-ig` repo: `nau-ig/backend/`

- [ ] Create `nau-ig/backend/package.json` with dependencies:
  - `express`, `@types/express`, `typescript`
  - `prisma`, `@prisma/client`
  - `jsonwebtoken`, `bcryptjs`
  - `zod` (request validation)
  - `cors`, `helmet`

- [ ] Create `nau-ig/backend/tsconfig.json`
- [ ] Create `nau-ig/backend/src/index.ts` â€” Express app bootstrap
- [ ] Create `nau-ig/backend/prisma/schema.prisma` (from 3.1)
- [ ] Create `nau-ig/backend/Dockerfile`
- [ ] Add backend service to `nau-ig/docker-compose.yml`

- [ ] Create `nau-ig/backend/.env.example` with:
  ```env
  PORT=3000
  NODE_ENV=development
  DATABASE_URL=postgresql://...
  JWT_SECRET=...
  NAU_SERVICE_KEY=...
  NAUTHENTICITY_API_URL=http://nauthenticity:3000
  FLOWNAU_API_URL=http://flownau:3000
  ```

### 3.3 â€” Implement Core API Endpoints

- [ ] `POST /auth/register` â€” Create user account
- [ ] `POST /auth/login` â€” Returns JWT
- [ ] `GET /captures` â€” List user's captures (paginated)
- [ ] `POST /captures` â€” Create a new capture with IG URL
- [ ] `GET /captures/:id` â€” Get single capture
- [ ] `PATCH /captures/:id` â€” Update notes, tags, SM-2 data
- [ ] `DELETE /captures/:id` â€” Soft delete
- [ ] `POST /captures/:id/sync` â€” Trigger sync for this capture (calls NauthenticityClient)
- [ ] `POST /captures/:id/publish` â€” Trigger publish (calls FlownauClient)
- [ ] `GET /captures/:id/publish-status` â€” Poll publish status

### 3.4 â€” Implement Background Sync Worker

- [ ] Create `nau-ig/backend/src/workers/sync.worker.ts`
- [ ] On schedule (every 60s or via BullMQ): find all `PENDING` captures
- [ ] For each: call `NauthenticityClient.scrapePost(instagramUrl)`
- [ ] Update `Capture` record with result
- [ ] Max 5 retries before setting `FAILED`

### 3.5 â€” Migrate Mobile App to Use Backend API

- [ ] Create `src/services/ApiClient.ts` in mobile app â€” HTTP client for the backend
- [ ] Replace all direct SQLite calls in screens with `ApiClient` calls
- [ ] SQLite remains as **offline write-ahead cache** only:
  - Capture is written to SQLite immediately (offline-first UX)
  - Background sync sends to backend when online
  - Backend is the source of truth

### 3.6 â€” Scaffold Web Client

- [ ] Create `nau-ig/web/` directory
- [ ] Initialize: `npx create-vite@latest ./ --template react-ts`
- [ ] Key pages:
  - `/feed` â€” Grid of captured posts
  - `/capture/:id` â€” Single post detail + notes + publish action
  - `/profiles` â€” Tracked IG profiles
  - `/settings` â€” App configuration

### 3.7 â€” Update `docker-compose.yml` for Full Stack

- [ ] `nau-ig/docker-compose.yml` should include:
  - `backend` service (Postgres, backend API)
  - `web` service (Vite dev server or Nginx static)
  - Both on `nau-network` network
  - Traefik labels for: `api.nau-ig.localhost` and `nau-ig.localhost`

---

## Verification Criteria

Phase 3 is complete when:

1. âœ… `nau-ig/backend/` contains a running Node.js/Express API.
2. âœ… `nau-ig/web/` contains a working React web client consuming the backend.
3. âœ… Mobile app connects to the backend instead of SQLite directly.
4. âœ… Capture sync calls `NauthenticityClient` (not Apify).
5. âœ… Publish action calls `FlownauClient` (not IG Graph API directly).
6. âœ… A post captured on mobile appears in the web client.

---

## Risk & Degradation Strategy

**Risk:** Mobile app goes offline before syncing to backend.  
**Response:** SQLite is the write-ahead cache. When connectivity returns, pending captures are flushed to backend automatically.  
**Risk:** Backend DB migration corrupts existing mobile data.  
**Response:** Mobile SQLite is never migrated â€” it operates independently as a cache. No data loss on mobile.

# PHASE 4 â€” Whisper Consolidation

## Objectives
A single `whisper-service` Docker container serves ALL transcription needs in the ecosystem. Both `echonau` and `nauthenticity` are migrated from their independent transcription implementations to call this shared HTTP endpoint.

**Pre-condition:** Phase 0 complete. Phases 1-3 can be concurrent.

---

## Context: Current State

### `whisper-service` (Docker)
- Already exists in `infrastructure/whisper/docker-compose.yml`
- Runs `openai/whisper-asr-webservice` HTTP API
- Exposes `POST /asr` â€” accepts audio file, returns transcript
- Currently: manually started, no other service calls it

### `nauthenticity/src/services/transcription.service.ts`
- Independent transcription service (1.4KB)
- Likely calls Whisper separately or uses OpenAI API
- Needs to be replaced with HTTP call to `whisper-service`

### `echonau/main.py` + `src/core/transcriber.py`
- Python app using `faster-whisper` library locally
- Runs the model IN-PROCESS (expensive, GPU-requiring)
- Should call `whisper-service` HTTP instead

---

## Tasks

### 4.1 â€” Audit Current Transcription Implementations

- [ ] Read `nauthenticity/src/services/transcription.service.ts` fully
- [ ] Read `echonau/src/core/transcriber.py` (or equivalent)
- [ ] Document in `.agent/TRANSCRIPTION_AUDIT.md`:
  - What format does each accept? (file path, base64, URL?)
  - What format does each return? (plain text, VTT, JSON with timestamps?)
  - What Whisper model is configured?

### 4.2 â€” Ensure `whisper-service` is Production-Ready

- [ ] Read `infrastructure/whisper/docker-compose.yml` fully
- [ ] Verify `POST /asr` accepts multipart file upload AND/OR base64 body
- [ ] Verify response returns both plain transcript and timestamped JSON
- [ ] Add Traefik labels so it's accessible internally as `http://whisper:9000` on `nau-network`
- [ ] Set `WHISPER__MODEL=small` (or configurable via env) â€” document model tradeoffs
- [ ] Add health check endpoint: `GET /health`

### 4.3 â€” Create Shared `WhisperClient` (TypeScript)

Since both `nauthenticity` (TS) and future TS services need this:

- [ ] Create a small, reusable HTTP client module:
  - **Option A** â€” Inline in each service (simple, no shared lib): create `src/services/whisper.client.ts` in `nauthenticity`
  - **Option B** â€” Shared npm package: `packages/whisper-client` (NOT recommended yet â€” overengineering for 2 consumers)
  - **Decision:** Option A. Copy the ~30-line client file into each TS consumer separately. If >3 consumers exist later, revisit.

- [ ] In `nauthenticity/src/services/whisper.client.ts`:
  ```typescript
  class WhisperClient {
    static async transcribe(audioFilePath: string): Promise<TranscriptResult>
    // TranscriptResult: { text: string, segments: { start, end, text }[] }
  }
  ```
  - Reads `WHISPER_SERVICE_URL` from env
  - Sends audio as multipart/form-data
  - Returns transcript and timestamped segments
  - Handles: 503 â†’ throws `ServiceUnavailableError`

### 4.4 â€” Migrate `nauthenticity` Transcription

- [ ] Replace `transcription.service.ts` content to use `WhisperClient`
- [ ] Remove any local Whisper model loading or `openai/whisper` SDK usage
- [ ] Add `WHISPER_SERVICE_URL=http://whisper:9000` to `nauthenticity/.env.example`
- [ ] Verify existing transcription tests still pass (update mocks if needed)

### 4.5 â€” Migrate `echonau` Transcription (Python)

- [ ] In `echonau/src/core/transcriber.py`, replace `faster-whisper` with HTTP call:
  ```python
  import requests
  
  class WhisperHttpClient:
    def transcribe(self, audio_path: str) -> str:
      url = os.getenv("WHISPER_SERVICE_URL", "http://whisper:9000")
      with open(audio_path, 'rb') as f:
        resp = requests.post(f"{url}/asr", files={'audio_file': f}, data={'encode': 'true'})
      resp.raise_for_status()
      return resp.json()['text']
  ```
- [ ] Add `WHISPER_SERVICE_URL=http://whisper:9000` to `echonau/.env`
- [ ] Update `requirements.txt`: remove `faster-whisper`, add `requests` if not present
- [ ] Update `echonau/docker-compose.yml` to join `nau-network` network

### 4.6 â€” Remove `faster-whisper` from `echonau`

- [ ] After migration: remove `faster-whisper` from `requirements.txt`
- [ ] Remove any local model cache directories (`.venv` model downloads)
- [ ] Update `echonau/Dockerfile` to remove GPU/CUDA dependencies

### 4.7 â€” Update `infrastructure` README

- [ ] Document `whisper-service` as a required shared service for transcription consumers
- [ ] Add: "Start whisper-service before running nauthenticity or echonau"
- [ ] Note GPU vs CPU mode and performance expectations

---

## Verification Criteria

Phase 4 is complete when:

1. âœ… `POST /asr` on `whisper-service` responds with transcript JSON.
2. âœ… `nauthenticity` `transcription.service.ts` calls `whisper-service` HTTP â€” no local model.
3. âœ… `echonau` calls `whisper-service` HTTP â€” no `faster-whisper` in requirements.
4. âœ… `grep -r "faster-whisper" echonau/` returns 0 results.
5. âœ… `grep -r "faster-whisper" nauthenticity/` returns 0 results.
6. âœ… End-to-end: trigger echonau on a test audio file â†’ transcript returned via whisper-service.

---

## Risk & Degradation Strategy

**Risk:** `whisper-service` is unavailable (e.g. not enough RAM).  
**Response:** `WhisperClient` throws `ServiceUnavailableError`. Transcription queue job fails â†’ retries with backoff. Media stored without transcript, flagged as `TRANSCRIPTION_PENDING` for later retry.  
**Note:** For local dev on low-RAM machines, `WHISPER__MODEL=tiny` is acceptable (lower quality but fast).

# PHASE 5 â€” Zazu Service Mesh Integration

## Objectives
Zazu gains authenticated access to the Platform Services, making it the conversational control plane for the entire NAÅ¬ ecosystem. Users can command platform capabilities via Telegram â€” triggering publishes, searching content, and querying system status.

**Pre-condition:** Phases 2 and 3 complete. `flownau` publish API is live. `nauthenticity` scrape/search API is live.

---

## Context

Zazu is currently a self-contained Telegram bot that:
- Handles conversational fallback (GPT-4o-mini)
- Has a modular "Skills" dispatcher architecture
- Stores all messages in Postgres
- Has an admin dashboard (Next.js)

It does NOT currently call any other NAÅ¬ Platform Services. Its skill architecture is designed for exactly this kind of integration.

---

## Tasks

### 5.1 â€” Extend Zazu's Environment with Service Registry

- [ ] Add to `zazu/.env.example`:
  ```env
  NAU_SERVICE_KEY=
  NAUTHENTICITY_API_URL=http://nauthenticity:3000
  FLOWNAU_API_URL=http://flownau:3000
  FLOWNAU_DEFAULT_ACCOUNT_ID=  # The default IG account to publish to
  ```
- [ ] Update `zazu/docker-compose.yml` to ensure Zazu joins `nau-network` network
  - Add `networks: nau-network: external: true`

### 5.2 â€” Create `NauthenticitySkill` in Zazu

- [ ] Create `zazu/apps/bot/src/skills/nauthenticity.skill.ts`
- [ ] Trigger phrase detection: `/search <query>` or "search my content: <query>"
- [ ] Skill logic:
  1. Extract query from message
  2. Call `GET /api/v1/content/search?q=<query>` on nauthenticity (with `NAU_SERVICE_KEY`)
  3. Return top 3 results formatted as Telegram messages (title + excerpt + IG URL)
- [ ] Register skill in main skill dispatcher

### 5.3 â€” Create `PublishSkill` in Zazu

- [ ] Create `zazu/apps/bot/src/skills/publish.skill.ts`
- [ ] Trigger: `/publish <flownau_composition_id>` or by sending a video file
- [ ] Skill logic:
  1. Call `GET /api/v1/accounts` on flownau to show available accounts
  2. User selects account via inline keyboard
  3. Call `POST /api/v1/publish` on flownau with selected account + media
  4. Return job status; poll `GET /api/v1/publish/:jobId` every 10s
  5. Send final "Published âœ…" or "Failed âŒ" message
- [ ] Register skill in main skill dispatcher

### 5.4 â€” Create `SystemStatusSkill` in Zazu

- [ ] Create `zazu/apps/bot/src/skills/system-status.skill.ts`
- [ ] Trigger: `/status`
- [ ] Skill logic: ping `GET /health` on each Platform Service
  - `nauthenticity`, `flownau`, `whatsnau`, `komunikadoj`, `whisper-service`
- [ ] Return formatted status report in Telegram: service name + UP/DOWN + latency

### 5.5 â€” Secure Zazu Skills to Admin Users Only

- [ ] Skills that call Platform Services should be restricted to pre-authorized Telegram Chat IDs
- [ ] Add `ZAZU_ADMIN_CHAT_IDS=<comma-separated>` to `.env.example`
- [ ] Create `src/middleware/admin-guard.ts`: rejects non-admin users with friendly message

### 5.6 â€” Update Zazu Admin Dashboard

- [ ] Add a "Service Health" panel to the Zazu dashboard (Next.js)
  - Shows live status of all NAÅ¬ services
  - Calls Zazu's own `/api/system-status` â†’ which calls Platform Services
- [ ] Add an "Activity Log" panel showing which skills were triggered and when

---

## Verification Criteria

Phase 5 is complete when:

1. âœ… `/search content creation` in Telegram returns results from nauthenticity.
2. âœ… `/publish` in Telegram can trigger a flownau publish job.
3. âœ… `/status` in Telegram returns health of all Platform Services.
4. âœ… Skills are restricted to admin chat IDs only.
5. âœ… Zazu admin dashboard shows Service Health panel.

---

## Future Skills (Out of Scope for Phase 5 â€” Document for Later)
- `CaptureSkill`: Send an IG URL in Telegram â†’ captured in nau-ig backend
- `WhatsAppCampaignSkill`: Trigger a whatsnau campaign from Telegram
- `EchonauSkill`: Send a voice note â†’ transcript returned via whisper-service
- `AnalyticsSkill`: Query nauthenticity for top performing content this week

