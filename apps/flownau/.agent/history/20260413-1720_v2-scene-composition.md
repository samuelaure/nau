# flownaŭ v2 — Architectural Plan

> **Plan Scope:** Full redesign — Scene-based composition, dedicated render infrastructure, multi-format content, platform integration.
> **Created:** 2026-04-12
> **Project Type:** A — Platform Service

---

## A. Constraints & Principles

1. **AI writes. Code assembles.** The LLM generates creative text and selects scene sequences. Deterministic code handles layout, timing, frame math, and asset resolution. Zero tolerance for invalid composition output.
2. **Scene-based composition.** Atomic scene components are the creative primitives. The AI composes sequences of scenes — each scene type is a pre-built, typed, tested Remotion component.
3. **Audio-first timing.** When audio exists, its duration drives all frame calculations. No hardcoded durations.
4. **Rendering is isolated.** A dedicated render container handles all Remotion + FFmpeg work. The app container never renders.
5. **Multi-format from day one.** The `ContentPiece` abstraction supports reels, trial reels, carousels, and single images with the same pipeline.
6. **Self-hosted only.** All infrastructure runs on Hetzner CX23/CX32. No cloud rendering services.
7. **Multi-brand at scale.** 10+ brands, 10+ content pieces per brand per day. Pipeline must handle 100+ daily compositions.
8. **Seamless platform integration.** All cross-service APIs use `NAU_SERVICE_KEY` auth. Explicit contracts with nauthenticity, Zazŭ, and 9naŭ API.

---

## B. Project Identity

| Field | Value |
|-------|-------|
| Name | flownaŭ |
| Type | A — Platform Service |
| Version Target | v1.0.0 (reset from 0.5.x — this is a redesign) |
| Framework | Next.js 15 (App Router) |
| Video Engine | Remotion 4 (Headless, dedicated container) |
| ORM | Prisma 7 |
| Database | PostgreSQL 15 |
| Queue | Redis 7 (render job queue via BullMQ) |
| AI | OpenAI GPT-4o (composition — Structured Outputs), Groq Llama 3.3 (ideation) |
| Storage | Cloudflare R2 |
| Video Processing | FFmpeg 6 |
| Publishing | Instagram Graph API v19+ |
| Auth | NextAuth (dashboard UI), NAU_SERVICE_KEY (cross-service API) |

---

## C. Architectural Blueprint

### C.1 Module Structure

```
src/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   ├── ideation/route.ts       # Generates ideas on schedule
│   │   │   ├── composer/route.ts       # Composes approved ideas into content pieces
│   │   │   └── publisher/route.ts      # Publishes rendered content to Instagram
│   │   ├── v1/                         # Cross-service API (NAU_SERVICE_KEY auth)
│   │   │   ├── compose/route.ts        # POST — trigger composition (reactive)
│   │   │   ├── daily-plan/[accountId]/route.ts  # GET — daily content plan
│   │   │   ├── ideas/ingest/route.ts   # POST — ingest ideas from external sources
│   │   │   ├── accounts/route.ts       # GET — list social accounts
│   │   │   └── health/route.ts         # GET — health check
│   │   ├── compositions/               # Dashboard CRUD
│   │   ├── assets/                     # Dashboard asset management
│   │   ├── auth/                       # NextAuth routes
│   │   └── templates/                  # Scene configuration
│   ├── dashboard/                      # Next.js pages (UI)
│   └── login/
├── modules/
│   ├── composer/                       # ★ NEW — Core pipeline
│   │   ├── scene-composer.ts           # AI agent: picks scenes + fills text slots
│   │   ├── timeline-compiler.ts        # Deterministic: scenes → valid composition JSON
│   │   ├── asset-curator.ts            # Intelligent asset selection
│   │   ├── caption-generator.ts        # AI: generates caption + hashtags
│   │   ├── content-piece.ts            # ContentPiece type definitions
│   │   └── model-resolver.ts           # Single utility: AIModel enum → model string
│   ├── scenes/                         # ★ NEW — Scene component library
│   │   ├── video/                      # Video scene Remotion components
│   │   │   ├── HookTextScene.tsx
│   │   │   ├── TextOverMediaScene.tsx
│   │   │   ├── QuoteCardScene.tsx
│   │   │   ├── ListRevealScene.tsx
│   │   │   ├── MediaOnlyScene.tsx
│   │   │   ├── CTACardScene.tsx
│   │   │   └── TransitionScene.tsx
│   │   ├── image/                      # Image/carousel scene components
│   │   │   ├── CoverSlide.tsx
│   │   │   ├── ContentSlide.tsx
│   │   │   ├── QuoteSlide.tsx
│   │   │   ├── ListSlide.tsx
│   │   │   └── CTASlide.tsx
│   │   ├── primitives/                 # Shared sub-components
│   │   │   ├── SafeText.tsx            # Text with safe zones + auto-scaling
│   │   │   ├── MediaBackground.tsx     # Video/image background with offset
│   │   │   ├── DarkOverlay.tsx         # Contrast overlay
│   │   │   ├── AudioTrack.tsx          # Audio with offset support
│   │   │   └── BrandWatermark.tsx      # Brand handle/logo overlay
│   │   ├── scene-registry.ts           # Maps scene type string → component + schema
│   │   └── scene-schema.ts             # Zod schemas for all scene types
│   ├── renderer/                       # ★ NEW — Render queue system
│   │   ├── render-queue.ts             # BullMQ job management
│   │   ├── render-worker.ts            # Worker: picks jobs → renders → uploads
│   │   ├── render-entry.tsx            # Remotion registerRoot for renderer
│   │   └── still-renderer.ts           # renderStill for images/carousels
│   ├── publisher/                      # ★ REFACTORED — Publishing logic
│   │   ├── instagram-reels.ts          # Reels + Trial Reels publishing
│   │   ├── instagram-carousel.ts       # Carousel publishing
│   │   ├── instagram-photo.ts          # Single image publishing
│   │   ├── instagram-token.ts          # Token refresh logic
│   │   └── publish-orchestrator.ts     # Routes content to correct publisher
│   ├── ideation/                       # EXISTING — Enhanced
│   │   ├── ideation.service.ts         # Primary ideation engine (InspoItems + Brand DNA)
│   │   └── sources/                    # Content source adapters
│   │       ├── inspo-source.ts         # nauthenticity InspoItems
│   │       ├── brand-dna-source.ts     # Brand DNA based ideation
│   │       └── external-source.ts      # 9naŭ / echonau / manual input
│   ├── planning/                       # ★ NEW — Content calendar
│   │   ├── daily-plan.service.ts       # Generates daily content plans
│   │   └── schedule.service.ts         # Posting schedule management
│   ├── accounts/                       # EXISTING — Preserved
│   │   ├── actions.ts
│   │   ├── apify.ts
│   │   └── instagram.ts               # → Deprecated, logic moves to publisher/
│   ├── shared/                         # EXISTING — Preserved
│   │   ├── prisma.ts
│   │   ├── r2.ts
│   │   ├── encryption.ts
│   │   ├── logger.ts
│   │   ├── nau-auth.ts                 # ★ NEW — NAU_SERVICE_KEY middleware
│   │   └── utils.ts
│   └── video/                          # EXISTING — Partially deprecated
│       ├── r2-sync-service.ts          # KEPT — R2 asset sync
│       ├── ffmpeg.ts                   # KEPT — FFmpeg utilities
│       └── [DEPRECATED]               # agent.ts, builderAgent.ts, renderer.ts → REMOVED
├── types/
│   ├── index.ts                        # KEPT
│   ├── scenes.ts                       # ★ NEW — Scene type definitions
│   └── content.ts                      # ★ NEW — ContentPiece, CreativeDirection types
└── lib/
    └── logger.ts                       # KEPT
```

### C.2 Data Model

#### Modified Models

```prisma
model Asset {
  id               String         @id @default(cuid())
  accountId        String?
  templateId       String?
  type             String                              // VID | AUD | IMG
  systemFilename   String
  originalFilename String
  r2Key            String
  url              String
  size             Int
  mimeType         String
  hash             String?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  thumbnailUrl     String?
  duration         Float?
  description      String?        @db.Text
  tags             String[]       @default([])         // ★ NEW
  lastUsedAt       DateTime?                           // ★ NEW
  usageCount       Int            @default(0)          // ★ NEW
  account          SocialAccount? @relation(fields: [accountId], references: [id], onDelete: Cascade)
  template         Template?      @relation(fields: [templateId], references: [id])
}

model Composition {
  id               String        @id @default(cuid())
  accountId        String
  templateId       String?                             // ★ NOW OPTIONAL (scene-based doesn't need it)
  format           String        @default("reel")      // ★ NEW: reel | trial_reel | carousel | single_image
  creative         Json?                               // ★ NEW: AI CreativeDirection output
  payload          Json                                // The compiled composition schema
  videoUrl         String?
  coverUrl         String?                             // ★ NEW: Cover image for reels
  caption          String?       @db.Text
  hashtags         String[]      @default([])          // ★ NEW
  externalPostId   String?
  externalPostUrl  String?
  status           String        @default("draft")     // ★ CHANGED: lowercase enum values
  // Status flow: draft → approved → rendering → rendered → scheduled → publishing → published | failed
  scheduledAt      DateTime?
  publishAttempts  Int           @default(0)
  lastPublishError String?       @db.Text
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  ideaId           String?                             // ★ NEW: back-reference
  renderJob        RenderJob?                          // ★ NEW
  account          SocialAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  template         Template?     @relation(fields: [templateId], references: [id])
  idea             ContentIdea?  @relation(fields: [ideaId], references: [id])
}

model ContentIdea {
  id           String        @id @default(cuid())
  accountId    String
  ideaText     String        @db.Text
  source       String        @default("internal")      // ★ NEW: internal | inspo | user_input | reactive
  sourceRef    String?                                  // ★ NEW: e.g., InspoItem ID, 9naŭ block ID
  status       String        @default("PENDING")
  createdAt    DateTime      @default(now())
  compositions Composition[]                            // ★ NEW: back-reference
  account      SocialAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

model SocialAccount {
  // ALL existing fields preserved
  // Add:
  tokenExpiresAt   DateTime?                           // ★ NEW: Track token expiry
  tokenRefreshedAt DateTime?                           // ★ NEW: Last refresh timestamp
}
```

#### New Models

```prisma
model RenderJob {
  id            String      @id @default(cuid())
  compositionId String      @unique
  status        String      @default("queued")         // queued | rendering | uploading | done | failed
  progress      Float       @default(0)
  outputUrl     String?                                // R2 URL of rendered output
  outputType    String      @default("video")          // video | image | images
  error         String?     @db.Text
  attempts      Int         @default(0)
  maxAttempts   Int         @default(3)
  startedAt     DateTime?
  completedAt   DateTime?
  renderTimeMs  Int?                                   // Track performance
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  composition   Composition @relation(fields: [compositionId], references: [id], onDelete: Cascade)
}

model ContentPlan {
  id          String        @id @default(cuid())
  accountId   String
  date        DateTime      @db.Date
  pieces      Json                                     // Planned content pieces summary
  scripts     Json?                                    // Head-talk recording scripts
  delivered   Boolean       @default(false)
  deliveredAt DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  account     SocialAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, date])
}
```

#### Deleted Models
- `Render` — Replaced by `RenderJob`

### C.3 API Surface

#### Cross-Service API (`/api/v1/*` — NAU_SERVICE_KEY auth)

| Method | Endpoint | Consumer | Purpose |
|--------|----------|----------|---------|
| `GET` | `/api/v1/health` | All | Health check |
| `POST` | `/api/v1/compose` | 9naŭ API, Zazŭ | Trigger reactive composition |
| `POST` | `/api/v1/ideas/ingest` | 9naŭ API (triage module) | Ingest content ideas from external source |
| `GET` | `/api/v1/daily-plan/:accountId` | Zazŭ | Get today's content plan |
| `GET` | `/api/v1/accounts` | Zazŭ | List social accounts |
| `GET` | `/api/v1/compositions?accountId=X&status=Y` | Zazŭ | Query compositions by status |

#### Request/Response Contracts

**POST `/api/v1/compose`**
```typescript
// Request
{
  accountId: string
  prompt: string                    // Content idea or raw text
  format?: 'reel' | 'trial_reel' | 'carousel' | 'single_image'  // Default: 'reel'
  source?: string                   // 'zazu' | '9nau' | 'echonau'
  sourceRef?: string                // External reference ID
  autoApprove?: boolean             // Skip manual approval
}
// Response
{ compositionId: string, status: 'draft' | 'approved' }
```

**POST `/api/v1/ideas/ingest`**
```typescript
// Request
{
  accountId: string
  ideas: {
    text: string
    source: 'inspo' | 'user_input' | 'reactive'
    sourceRef?: string
  }[]
  autoApprove?: boolean
}
// Response
{ created: number, ids: string[] }
```

**GET `/api/v1/daily-plan/:accountId`**
```typescript
// Response
{
  date: string                      // ISO date
  pieces: {
    id: string
    format: string
    status: string
    scheduledAt: string | null
    caption: string | null
    sceneSummary: string            // "HookText → TextOverMedia × 3 → CTA"
  }[]
  scripts: {
    ideaId: string
    hook: string
    body: string
    estimatedDuration: string       // "~45s"
    notes: string
  }[]
  stats: {
    total: number
    rendered: number
    published: number
    pending: number
  }
}
```

#### Cron Endpoints (internal, no auth required)

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `GET /api/cron/ideation` | Configurable per account | Generate content ideas |
| `GET /api/cron/composer` | Every 30 min | Compose approved ideas into content pieces |
| `GET /api/cron/publisher` | Every 15 min | Publish rendered content per schedule |

#### Dashboard API (NextAuth session auth — existing pattern, preserved)

All existing dashboard routes under `/api/compositions/`, `/api/ideas/`, `/api/assets/`, `/api/templates/`, `/api/personas/`, `/api/schedule/` are **preserved**.

### C.4 Scene Type Registry

Each scene type is defined by:
- A unique string identifier
- A Zod schema for its text/content slots
- A Remotion React component
- A description (provided to the AI for scene selection)
- A default duration range (seconds)

#### Video Scene Types

| Scene Type | Slots | Default Duration | Description (for AI) |
|-----------|-------|-----------------|----------------------|
| `hook-text` | `{ hook: string }` | 2-3s | Bold text on gradient/dark background. Grabs attention. No media. |
| `text-over-media` | `{ text: string }` | 3-5s | Text overlay on B-roll video. The workhorse scene for Reels. |
| `quote-card` | `{ quote: string, attribution?: string }` | 3-4s | Centered quote with stylized borders on subtle background. |
| `list-reveal` | `{ items: string[], title?: string }` | 4-6s | Items appear one by one with animation. Great for tips/lists. |
| `media-only` | `{}` (no text slots) | 2-3s | Pure B-roll. Breathing room between text-heavy scenes. |
| `cta-card` | `{ cta: string, handle?: string }` | 2-3s | Brand CTA with optional profile handle. End card. |
| `transition` | `{}` | 0.5-1s | Visual breather (fade, swipe). Between scenes. |

#### Image Scene Types

| Scene Type | Slots | Dimensions | Description (for AI) |
|-----------|-------|-----------|----------------------|
| `cover-slide` | `{ title: string, subtitle?: string }` | 1080×1350 | Carousel cover. Hook/title. Must grab attention. |
| `content-slide` | `{ heading: string, body: string }` | 1080×1350 | Information slide with heading + body text. |
| `quote-slide` | `{ quote: string, attribution?: string }` | 1080×1350 | Stylized quote. Decorative borders. |
| `list-slide` | `{ title: string, items: string[] }` | 1080×1350 | Numbered or bulleted list. |
| `cta-slide` | `{ cta: string, handle: string }` | 1080×1350 | Final slide. Follow CTA with brand handle. |

### C.5 Core Algorithms

#### Asset Selection Algorithm (AssetCurator)

```
INPUT: scene (type, mood, assetHint), assetPool, requiredDurationSeconds
OUTPUT: selected Asset or null

1. FILTER by content type:
   - Video scenes → VID assets only
   - Image scenes → IMG assets only (or VID for thumbnail extraction)
   - Audio → AUD assets only

2. FILTER by duration (video/audio only):
   - EXCLUDE assets where asset.duration < requiredDurationSeconds
   - This GUARANTEES no black frames (Point H)

3. FILTER outputs:
   - EXCLUDE assets where r2Key contains '/outputs/' (renders, not source material)

4. SCORE each remaining asset:
   - tagMatchScore: +10 per matching tag with scene.mood or scene.assetHint
   - recencyPenalty: -5 if used in last 24h, -3 if last 48h, -1 if last 7d
   - usageCountPenalty: -(usageCount * 0.5), capped at -5
   - randomFactor: +random(0, 2) for variety

5. SORT by score descending

6. SELECT top asset

7. UPDATE selected asset: lastUsedAt = now(), usageCount++

FALLBACK: If no assets pass duration filter, pick longest available + log warning
```

#### Timeline Compilation Algorithm (TimelineCompiler)

```
INPUT: CreativeDirection, resolvedAssets, brandStyle, format
OUTPUT: valid DynamicCompositionSchema (guaranteed by Zod)

1. SELECT AUDIO (for video formats):
   - Pick audio asset matching suggestedAudioMood
   - audioDuration = selectedAudio.duration ?? 15 (seconds)

2. CALCULATE TOTAL DURATION:
   - totalSeconds = audioDuration (audio-first principle)
   - totalFrames = totalSeconds × 30 (fps)

3. DISTRIBUTE SCENE DURATIONS:
   - Sum of default durations from scene type definitions
   - Scale proportionally to fit totalSeconds
   - Ensure minimum 1 second per scene
   - Ensure transition scenes stay at 0.5-1s

4. CALCULATE FRAME POSITIONS:
   - currentFrame = 0
   - For each scene:
     - scene.startFrame = currentFrame
     - scene.durationInFrames = round(sceneDuration × fps)
     - currentFrame += scene.durationInFrames

5. RESOLVE MEDIA OFFSETS:
   - For each media asset:
     - maxStartOffset = asset.duration - sceneDurationSeconds
     - mediaStartAt = random(0, maxStartOffset) × fps
     - This ensures the clip never runs out before the scene ends

6. COMPILE TRACKS:
   - media[]: One entry per scene that has a background media asset
   - text[]: One entry per scene that has text content
   - overlay[]: One entry per scene with text (dark overlay for readability)
   - audio[]: One entry for the background audio (full duration)

7. VALIDATE: DynamicCompositionSchema.parse(result)
   - If this throws, it's a BUG in the compiler, not an AI problem
```

### C.6 Platform Integration Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        naŭ Platform                             │
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────┐  │
│  │ nauthenticity │────▶│   flownaŭ    │◀────│   9naŭ API    │  │
│  │              │     │              │     │               │  │
│  │ Provides:    │     │ Owns:        │     │ Sends:        │  │
│  │ • InspoItems │     │ • Composition│     │ • Reactive    │  │
│  │ • Brand DNA  │     │ • Rendering  │     │   triggers    │  │
│  │              │     │ • Publishing │     │ • Triage ideas│  │
│  └──────────────┘     │ • Scheduling │     └────────────────┘  │
│                       │ • Assets     │                          │
│                       │ • Plans      │     ┌────────────────┐  │
│                       │              │────▶│     zazŭ       │  │
│                       └──────────────┘     │               │  │
│                              │             │ Consumes:     │  │
│                              │             │ • Daily Plan  │  │
│                              ▼             │ • Status      │  │
│                       ┌──────────────┐     │ • Triggers    │  │
│                       │  Instagram   │     └────────────────┘  │
│                       │  Graph API   │                          │
│                       └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

**Integration Contracts:**

| From | To | Mechanism | Auth | Failure Mode |
|------|----|-----------|------|-------------|
| flownaŭ | nauthenticity | HTTP GET `/api/v1/content/search` | NAU_SERVICE_KEY | Graceful: skip InspoItems, use Brand DNA only |
| 9naŭ API (triage) | flownaŭ | HTTP POST `/api/v1/ideas/ingest` | NAU_SERVICE_KEY | Retry with exponential backoff |
| 9naŭ API | flownaŭ | HTTP POST `/api/v1/compose` | NAU_SERVICE_KEY | Retry with exponential backoff |
| Zazŭ | flownaŭ | HTTP GET `/api/v1/daily-plan/:id` | NAU_SERVICE_KEY | Return cached plan or "no plan available" |
| flownaŭ | Instagram | HTTPS (Graph API) | OAuth token | 3-retry, then mark FAILED |

---

## D. Starter Instructions

### D.1 No New Scaffold Needed
This is a redesign of an existing project. The folder structure evolves from `src/modules/` as defined in C.1. No `npx create-*` required.

### D.2 New Dependencies

```
# Required new packages
bullmq                  # Render job queue (Redis-backed)
@remotion/studio        # Dev-time preview (already installed as @remotion/studio-server)
```

### D.3 Dependencies to Remove

```
# Removable (orphaned or replaced)
airtable                # Legacy content source (replaced by nauthenticity)
groq-sdk                # Keep in package.json but remove direct usage from agent.ts
```

> Note: `groq-sdk` stays installed because it's still used for ideation. The removal only targets the duplicated instantiation pattern.

### D.4 Files to Delete

```
src/modules/video/agent.ts                              # Replaced by composer/scene-composer.ts
src/modules/video/builderAgent.ts                       # Replaced entirely
src/modules/video/renderer.ts                           # Replaced by renderer/render-worker.ts
src/modules/video/remotion/UniversalComposition.tsx     # Orphaned template system
src/modules/video/remotion/templates/                   # Old templates (if any)
src/modules/video/config/tutorialContent.ts             # Static tutorial data
src/modules/rendering/DynamicCompositionMock/           # Mock data
src/types/video-schema.ts                               # Replaced by types/scenes.ts + types/content.ts
src/modules/accounts/instagram.ts                       # Moves to publisher/instagram-reels.ts
```

---

## E. Local Infrastructure

| Service | Container Name | Port | Memory | CPU |
|---------|---------------|------|--------|-----|
| App (Next.js) | `flownau` | 3000 | 384MB | 0.4 |
| Renderer (Headless) | `flownau_renderer` | — (no port) | 1536MB | 1.0 |
| PostgreSQL | `flownau_postgres` | 5432 (internal) | 192MB | 0.35 |
| Redis | `flownau_redis` | 6379 (internal) | 64MB | 0.1 |

**Total: 2,176MB** — fits within CX23's ~3GB available.

### Environment Variables (additions)

```env
# Render worker
RENDER_CONCURRENCY=2                    # Frames rendered in parallel
RENDER_MAX_ATTEMPTS=3                   # Max retry per render job
RENDER_POLL_INTERVAL_MS=5000            # How often renderer checks for jobs

# Instagram token management
TOKEN_REFRESH_DAYS_BEFORE_EXPIRY=7      # Refresh token 7 days before it expires

# Content planning
DAILY_PLAN_SEND_HOUR_EVENING=22         # 10 PM — evening summary
DAILY_PLAN_SEND_HOUR_MORNING=7          # 7 AM — morning reminder

# nauthenticity integration
NAUTHENTICITY_URL=http://nauthenticity:3000
```

---

## F. Infrastructure Strategy

### Updated `docker-compose.yml` Design

```yaml
services:
  app:
    container_name: flownau
    image: ghcr.io/samuelaure/flownau/app:${TAG:-latest}
    env_file: .env
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@flownau_postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@flownau_redis:6379
    depends_on:
      flownau_postgres: { condition: service_healthy }
      flownau_redis: { condition: service_healthy }
    networks: [nau-network]
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.flownau.rule=Host(`${PUBLIC_DOMAIN:-flownau.localhost}`)'
      - 'traefik.http.routers.flownau.entrypoints=websecure'
      - 'traefik.http.routers.flownau.tls=true'
      - 'traefik.http.routers.flownau.tls.certresolver=letsencrypt'
      - 'traefik.http.services.flownau.loadbalancer.server.port=3000'
      - 'traefik.docker.network=nau-network'
    restart: unless-stopped
    deploy:
      resources:
        limits: { memory: 384M, cpus: '0.40' }
    logging: { driver: json-file, options: { max-size: '10m', max-file: '3' } }

  renderer:
    container_name: flownau-renderer
    image: ghcr.io/samuelaure/flownau/renderer:${TAG:-latest}
    env_file: .env
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@flownau_postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@flownau_redis:6379
      - FFMPEG_PATH=/usr/bin/ffmpeg
      - FFPROBE_PATH=/usr/bin/ffprobe
    depends_on:
      flownau_postgres: { condition: service_healthy }
      flownau_redis: { condition: service_healthy }
    networks: [nau-network]
    # No Traefik labels — this container has no web traffic
    restart: unless-stopped
    deploy:
      resources:
        limits: { memory: 1536M, cpus: '1.0' }
    logging: { driver: json-file, options: { max-size: '10m', max-file: '3' } }

  flownau_postgres:
    image: postgres:15-alpine
    container_name: flownau-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}']
      interval: 5s
      timeout: 5s
      retries: 5
    networks: [nau-network]
    logging: { driver: json-file, options: { max-size: '10m', max-file: '3' } }
    volumes: [postgres_data:/var/lib/postgresql/data]

  flownau_redis:
    image: redis:alpine
    container_name: flownau-redis
    restart: unless-stopped
    command: redis-server --requirepass "${REDIS_PASSWORD}" --maxmemory 64mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ['CMD-SHELL', 'redis-cli -a "$$REDIS_PASSWORD" ping']
      interval: 5s
      timeout: 5s
      retries: 5
    networks: [nau-network]
    logging: { driver: json-file, options: { max-size: '10m', max-file: '3' } }
    volumes: [redis_data:/data]

networks:
  nau-network:
    external: true

volumes:
  postgres_data:
  redis_data:
```

### Renderer Dockerfile (new)

The renderer shares the same codebase but runs a different entrypoint:
```dockerfile
# Dockerfile.renderer
FROM node:20-slim
RUN apt-get update && apt-get install -y chromium ffmpeg && rm -rf /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npx prisma generate
CMD ["node", "dist/renderer/worker.js"]
```

---

## G. Execution Roadmap

| Phase | Name | Objective | Depends On |
|-------|------|-----------|------------|
| 1 | Foundation & Cleanup | Remove dead code, extend schema, extract utilities, fix bugs | — |
| 2 | Scene Library & Composer | Build scene components, AI slot filler, timeline compiler, asset curator | Phase 1 |
| 3 | Render Infrastructure | Dedicated renderer container, async queue, retry logic | Phase 2 |
| 4 | Multi-Format & Publishing | Trial Reels, Carousel, Single Image publishing | Phase 3 |
| 5 | Content Plan & Platform Integration | Daily plans, Zazŭ delivery, reactive triggers, token refresh | Phase 4 |
# Phase 1 — Foundation & Cleanup

> **Objective:** Remove dead code, extend the database schema, extract shared utilities, and fix known bugs. This phase creates a clean surface for Phase 2 to build on. No new features — only structural improvements.

---

## Objectives

1. Delete all orphaned code identified in the analysis
2. Create database migrations for new/modified fields
3. Extract duplicated logic into shared utilities
4. Fix known bugs (AudioNode, token expiry tracking)
5. Wire the production-quality ideation engine into the cron pipeline
6. Add NAU_SERVICE_KEY auth middleware for cross-service API

---

## Tasks

### 1.1 — Delete Orphaned Code

- [x] Delete `src/modules/video/builderAgent.ts` (replaced by scene-composer in Phase 2)
- [x] Delete `src/modules/video/remotion/UniversalComposition.tsx` (orphaned template system)
- [x] Delete `src/modules/video/remotion/templates/` directory (legacy templates, if exists)
- [x] Delete `src/modules/video/config/tutorialContent.ts` (static tutorial data)
- [x] Delete `src/modules/rendering/DynamicCompositionMock/` directory (mock data)
- [x] Delete `src/types/video-schema.ts` (replaced by `types/scenes.ts` in Phase 2)
- [x] Delete the `Render` model from `prisma/schema.prisma` and generate migration
- [x] Remove `InstagramPost` composition registration from `src/modules/video/remotion/index.tsx` (keep `DynamicTemplateMaster` for now)
- [x] Remove `airtable` dependency from `package.json` and delete `src/modules/video/airtable.ts`

### 1.2 — Database Schema Extension

- [x] Add to `Asset` model: `tags String[] @default([])`, `lastUsedAt DateTime?`, `usageCount Int @default(0)`
- [x] Add to `Composition` model: `format String @default("reel")`, `creative Json?`, `coverUrl String?`, `hashtags String[] @default([])`, `ideaId String?` (with relation to ContentIdea)
- [x] Make `Composition.templateId` optional (nullable) — scene-based compositions don't require a template
- [x] Add to `ContentIdea` model: `source String @default("internal")`, `sourceRef String?`, add `compositions Composition[]` relation
- [x] Add to `SocialAccount` model: `tokenExpiresAt DateTime?`, `tokenRefreshedAt DateTime?`
- [x] Create `RenderJob` model (see PLAN.md C.2)
- [x] Create `ContentPlan` model (see PLAN.md C.2)
- [x] Run `npx prisma migrate dev --name v2_foundation` and verify migration applies cleanly
- [x] Verify seed script still works after schema changes

### 1.3 — Extract Shared Utilities

- [x] Create `src/modules/composer/model-resolver.ts`:
  ```
  Export: resolveModelId(modelSelection: AIModel): { provider: 'openai' | 'groq', model: string }
  Purpose: Single source of truth for AIModel enum → provider + model string mapping
  Replaces: ~30 lines of nested ternaries duplicated in agent.ts (×2), builderAgent.ts
  ```
- [x] Create `src/modules/shared/nau-auth.ts`:
  ```
  Export: validateServiceKey(request: Request): boolean
  Purpose: Middleware for NAU_SERVICE_KEY authentication on /api/v1/* routes
  Pattern: Check 'x-service-key' header against process.env.NAU_SERVICE_KEY
  ```
- [x] Create `src/types/content.ts`:
  ```
  Export: ContentFormat type ('reel' | 'trial_reel' | 'carousel' | 'single_image')
  Export: CompositionStatus type (all status values as union type)
  Export: IdeaSource type ('internal' | 'inspo' | 'user_input' | 'reactive')
  Purpose: Centralize string literal types used in Composition and ContentIdea
  ```

### 1.4 — Fix Known Bugs

- [x] Fix `src/modules/rendering/DynamicComposition/primitives/AudioNode.tsx`:
  - Current: `startFrom={0}` (hardcoded)
  - Fix: `startFrom={node.mediaStartAt ?? 0}` (use schema value)
  - Note: `mediaStartAt` is already in `AudioNodeSchema` but needs to be added as a field. Check if schema has it — if not, add `mediaStartAt: z.number().default(0)` to `AudioNodeSchema`.
- [x] Verify `AudioNodeSchema` in `schema.ts` includes `mediaStartAt` field — add if missing
- [x] Add Instagram token expiry tracking to account connection flow:
  - When storing access token, also store `tokenExpiresAt` (long-lived tokens = 60 days from creation)
  - When `tokenRefreshedAt` is older than 53 days (7 day buffer), queue refresh

### 1.5 — Wire Production Ideation Engine

- [x] Update `GET /api/cron/ideation` (rename from `/api/cron/generator`'s ideation part):
  - Replace usage of `generateContentIdeas()` from `agent.ts`
  - Use `ideation.service.ts → generateContentIdeas()` instead
  - This connects: nauthenticity InspoItems → Brand DNA → proper structured ideas
- [x] Ensure `ideation.service.ts` handles missing nauthenticity gracefully:
  - If nauthenticity is unreachable → fall back to Brand DNA only ideation
  - Log warning, don't crash

### 1.6 — Create v1 API Foundation

- [x] Create `src/app/api/v1/health/route.ts`:
  ```
  GET: Returns { status: 'ok', version: '1.0.0', timestamp: Date.now() }
  No auth required.
  ```
- [x] Create route group handler with NAU_SERVICE_KEY validation:
  - All `/api/v1/*` routes (except `/health`) must validate the service key
  - Use the `nau-auth.ts` middleware from task 1.3
- [x] Create placeholder routes (return 501 Not Implemented) for:
  - `POST /api/v1/compose`
  - `POST /api/v1/ideas/ingest`
  - `GET /api/v1/daily-plan/[accountId]`
  - `GET /api/v1/accounts`
  - `GET /api/v1/compositions`
  These will be implemented in later phases but the route structure must exist now.

### 1.7 — Cron Restructure

- [x] Rename cron routes for clarity:
  - `/api/cron/generator` → `/api/cron/composer` (will compose approved ideas in Phase 2)
  - Keep `/api/cron/publisher` as-is
  - Create `/api/cron/ideation` (new — generates ideas on schedule)
- [x] The existing generator cron logic (compose approved ideas) is preserved but will be replaced in Phase 2. For now, keep it working as-is on the renamed route.

builder: [Phase 1 complete. Deleted obsolete modules and dead code. Generated required Prisma database extensions for Phase 2/3 (leaving old Render table as deprecated until V2 takes over fully). Established type-safe utilities for model selection and cross-service authentification (`NAU_SERVICE_KEY`). Fixed `AudioNode` logic. Cleaned and wired standard chron routes: `composer`, `ideation`, `publisher`.]

---

## Verification Criteria

1. **Build passes:** `npm run build` completes with zero errors
2. **Type check passes:** `npm run type-check` completes with zero errors
3. **Schema migrates:** `npx prisma migrate dev` applies cleanly
4. **Seed works:** `npx prisma db seed` runs without errors
5. **Tests pass:** `npm run test` — all existing tests pass (the infra test)
6. **No regressions:** The existing composition → render → publish pipeline still works (even though it will be replaced in Phase 2, it must not break during Phase 1)
7. **API routes respond:**
   - `GET /api/v1/health` → 200 `{ status: 'ok' }`
   - `POST /api/v1/compose` → 501 (with valid service key) or 401 (without)
8. **Model resolution utility:** `resolveModelId('GROQ_LLAMA_3_3')` returns `{ provider: 'groq', model: 'llama-3.3-70b-versatile' }` for all enum values
# Phase 2 — Scene Library & Composer Engine

> **Objective:** Build the new composition pipeline. Replace the free-form LLM JSON generation with deterministic scene-based composition. After this phase, every composition produced by the system is 100% valid — guaranteed by code, not by AI hope.

---

## Objectives

1. Build 7 video scene Remotion components (B-roll heavy)
2. Build the Scene Registry (maps type strings → components + schemas)
3. Build the SceneComposer AI agent (fills text slots, does NOT design layout)
4. Build the TimelineCompiler (deterministic frame math — never fails)
5. Build the AssetCurator (intelligent selection with duration + tag matching)
6. Wire the new pipeline into the composer cron
7. Replace `composeVideoWithAgent()` entirely

---

## Tasks

### 2.1 — Scene Type Definitions

- [ ] Create `src/types/scenes.ts`:
  - Define `VideoSceneType` union: `'hook-text' | 'text-over-media' | 'quote-card' | 'list-reveal' | 'media-only' | 'cta-card' | 'transition'`
  - Define Zod schemas for each scene type's slots:
    - `HookTextSlots: { hook: z.string().max(80) }`
    - `TextOverMediaSlots: { text: z.string().max(150) }`
    - `QuoteCardSlots: { quote: z.string().max(200), attribution: z.string().max(50).optional() }`
    - `ListRevealSlots: { title: z.string().max(60).optional(), items: z.array(z.string().max(80)).min(2).max(5) }`
    - `MediaOnlySlots: {} (empty object)`
    - `CTACardSlots: { cta: z.string().max(60), handle: z.string().max(30).optional() }`
    - `TransitionSlots: {} (empty object)`
  - Define `SceneDefinition` interface: `{ type, slots, mood, assetHint?, duration? }`
  - Define `CreativeDirection` interface (the AI output schema): `{ scenes: SceneDefinition[], caption: string, hashtags: string[], coverSceneIndex: number, suggestedAudioMood?: string }`
  - Export the `CreativeDirectionSchema` Zod schema for OpenAI Structured Outputs
  - Define `SCENE_CATALOG` constant: array of `{ type, description, defaultDurationRange, slotSchema }` — this is given to the AI as context
- [ ] Create `src/types/content.ts` (if not done in Phase 1):
  - `ContentFormat`, `CompositionStatus`, `IdeaSource` types

### 2.2 — Scene Remotion Components (Video)

All video scenes share these properties:
- Receive `brandStyle: { primaryColor, fontFamily, accentColor }` as props
- Use `SafeText` primitive for all text rendering (auto-scaling + safe zones)
- Use `MediaBackground` for B-roll backgrounds
- Use `DarkOverlay` for text readability
- Animated entrances (fade/slide/pop configurable per scene type)

- [ ] Create `src/modules/scenes/primitives/SafeText.tsx`:
  - Migrate and enhance logic from existing `ResponsiveTextNode.tsx`
  - Props: `{ text, fontSize, color, fontFamily, safeZone, animation, maxWidth }`
  - Auto-scale based on character count (existing logic)
  - Safe zone support (top-third, center-safe, bottom-third)
  - Animation support (fade, pop, slide-up, none)

- [ ] Create `src/modules/scenes/primitives/MediaBackground.tsx`:
  - Migrate and enhance from existing `ResponsiveMediaNode.tsx`
  - Props: `{ assetUrl, mediaStartAt, scale }`
  - Handles both video and image backgrounds
  - Uses `OffthreadVideo` for remote video URLs

- [ ] Create `src/modules/scenes/primitives/DarkOverlay.tsx`:
  - Migrate from existing `OverlayNode.tsx`
  - Props: `{ color, opacity }`
  - Fade-in animation synchronized with text appearance

- [ ] Create `src/modules/scenes/primitives/AudioTrack.tsx`:
  - Migrate from existing `AudioNode.tsx`
  - Props: `{ assetUrl, volume, startFrom }`
  - **Fix: use `startFrom` prop correctly (not hardcoded to 0)**

- [ ] Create `src/modules/scenes/primitives/BrandWatermark.tsx`:
  - Props: `{ handle, position, opacity }`
  - Small brand handle/logo in corner, low opacity
  - Position: configurable (bottom-left, bottom-right)

- [ ] Create `src/modules/scenes/video/HookTextScene.tsx`:
  - Visual: Bold text on gradient background (no B-roll)
  - Uses brand primary color as gradient base
  - Large font, center-safe zone
  - Pop animation
  - No media background needed

- [ ] Create `src/modules/scenes/video/TextOverMediaScene.tsx`:
  - Visual: Text overlaid on B-roll video
  - **This is the primary/workhorse scene for Reels**
  - MediaBackground + DarkOverlay (0.4 opacity) + SafeText
  - Text in center-safe or bottom-third safe zone
  - Fade animation

- [ ] Create `src/modules/scenes/video/QuoteCardScene.tsx`:
  - Visual: Centered quote with decorative borders
  - Subtle animated top/bottom border lines
  - Attribution text (smaller) below quote
  - Can optionally have B-roll background (dimmed)

- [ ] Create `src/modules/scenes/video/ListRevealScene.tsx`:
  - Visual: Items appearing one by one
  - Optional title at top
  - Each item fades/slides in with staggered timing
  - Stagger: divide scene duration by item count
  - B-roll background optional

- [ ] Create `src/modules/scenes/video/MediaOnlyScene.tsx`:
  - Visual: Full-screen B-roll, no text
  - Purpose: breathing room between text-heavy scenes
  - Optional BrandWatermark

- [ ] Create `src/modules/scenes/video/CTACardScene.tsx`:
  - Visual: Call-to-action with brand handle
  - Brand gradient background or dimmed B-roll
  - CTA text in center, handle at bottom
  - Slide-up animation

- [ ] Create `src/modules/scenes/video/TransitionScene.tsx`:
  - Visual: Short fade-to-black or wipe
  - Duration: 0.5-1 second
  - No content slots, pure visual breather

### 2.3 — Scene Registry

- [ ] Create `src/modules/scenes/scene-registry.ts`:
  - Export `getSceneComponent(type: VideoSceneType): React.FC`
  - Export `getSceneSchema(type: VideoSceneType): ZodSchema`
  - Export `getSceneDefaults(type: VideoSceneType): { minDuration, maxDuration, defaultDuration }`
  - Maps scene type strings to their components, schemas, and metadata
  - This is the single source of truth for scene type → component resolution

### 2.4 — Remotion Composition Update

- [ ] Update `src/modules/video/remotion/index.tsx`:
  - Replace hardcoded `DynamicTemplateMaster` default props
  - Register a new composition `SceneSequence` that accepts `{ scenes: ResolvedScene[], audio?: AudioConfig, brandStyle: BrandStyle }` as input props
  - Use `calculateMetadata` to derive dimensions, fps, duration from props
  - Keep `DynamicTemplateMaster` registered for backward compat during transition

- [ ] Create `src/modules/scenes/SceneSequenceComposition.tsx`:
  - The master composition that renders a sequence of scenes
  - Iterates over `scenes[]`, renders each scene's component inside a `<Sequence>` with correct timing
  - Adds audio track if present
  - Adds brand watermark if configured

### 2.5 — SceneComposer (AI Agent)

- [ ] Create `src/modules/composer/scene-composer.ts`:
  - **Input:** ContentIdea text, Brand DNA (persona systemPrompt), asset metadata summary (types + tags, NOT urls), content format
  - **AI Call:** OpenAI GPT-4o with Structured Outputs (`zodResponseFormat`)
  - **System Prompt Structure:**
    ```
    You are a Senior Creative Director for short-form social media video.
    
    BRAND VOICE: {persona.systemPrompt}
    
    AVAILABLE SCENE TYPES:
    {SCENE_CATALOG formatted with descriptions and slot schemas}
    
    AVAILABLE ASSET TAGS:
    {unique tags from account's asset pool}
    
    CONTENT IDEA:
    {idea.ideaText}
    
    FORMAT: {format} (reel = 10-15s video, carousel = 5-10 slides)
    
    RULES:
    1. Compose a sequence of 4-7 scenes for a reel (or 5-10 slides for a carousel)
    2. Start with a hook scene. End with a CTA scene.
    3. Use 'text-over-media' scenes heavily — they work best with B-roll content.
    4. Fill each scene's text slots according to the slot schema.
    5. Suggest a mood per scene for asset matching.
    6. Write a compelling Instagram caption (max 2000 chars).
    7. Suggest 5-15 relevant hashtags.
    8. Pick which scene should be the cover/thumbnail (coverSceneIndex).
    9. Write in the brand's natural language.
    ```
  - **Output:** `CreativeDirection` validated with `CreativeDirectionSchema.parse()`
  - **Error handling:** If AI output fails validation, retry once with error feedback. If 2nd attempt fails, log error and skip this idea (don't crash the batch).
  - Uses `resolveModelId()` from Phase 1 utility

### 2.6 — AssetCurator

- [x] Create `src/modules/composer/asset-curator.ts`:
  - **Function:** `selectMediaForScene(scene, assetPool, requiredDurationSec): Asset | null`
    1. Filter by type (VID for video scenes, IMG for image scenes)
    2. Filter by duration: asset.duration >= requiredDurationSec (guarantees no black frames)
    3. Exclude output assets (`/outputs/` in r2Key)
    4. Score: tagMatchScore + recencyPenalty + usageCountPenalty + randomFactor
    5. Pick top scorer
    6. Return null if no assets pass filters (handles gracefully)
  - **Function:** `selectAudio(assetPool, suggestedMood): Asset | null`
    1. Filter by type (AUD)
    2. Score by mood tag match + recency
    3. Return top scorer or null (reels without audio are allowed)
  - **Function:** `commitAssetUsage(assetId: string): void`
    - Updates `lastUsedAt` and increments `usageCount` in DB
    - Called after composition is successfully created (not during selection)

### 2.7 — TimelineCompiler

- [x] Create `src/modules/composer/timeline-compiler.ts`:
  - **Function:** `compileTimeline(creative, resolvedAssets, audio, brandStyle, format): DynamicCompositionSchema`
  - **Algorithm:** (as specified in PLAN.md C.5)
    1. Determine total duration from audio or default (15s)
    2. Distribute scene durations proportionally
    3. Calculate frame positions sequentially
    4. Resolve media offsets (random within safe range)
    5. Compile tracks: media[], text[], overlay[], audio[]
    6. Validate with `DynamicCompositionSchema.parse()` — this MUST always pass
  - **Guarantee:** If this function throws, it's a bug in the compiler code, never an AI issue. The AI's output was already validated in 2.5.
  - **Duration distribution logic:**
    - Sum all scene defaultDurations
    - Scale factor = totalDuration / sumOfDefaults
    - Multiply each scene's defaultDuration by scale factor
    - Clamp: respect min/max duration per scene type
    - Redistribute remainder to longest scene

### 2.8 — Caption Generator (Enhancement)

- [x] Create `src/modules/composer/caption-generator.ts`:
  - **Option A (default):** Caption is generated as part of SceneComposer's output (single AI call)
  - **Option B (premium):** Separate AI call with dedicated caption prompt for higher quality
  - For Phase 2, use Option A — the SceneComposer generates caption + hashtags
  - The dedicated `captionPrompt` field on Template is respected if set:
    - When a template has a `captionPrompt`, use it as additional instruction to the AI
  - Hashtag logic: AI suggests 5-15, system validates they don't contain banned words

### 2.9 — Wire New Pipeline into Cron

- [x] Update `/api/cron/composer` route:
  1. Fetch all `APPROVED` ContentIdeas (batch of 20)
  2. For each idea:
     a. Call `SceneComposer.compose(idea, persona, assetMetadata, format)`
     b. Call `AssetCurator.selectAssets(creative, assetPool)`
     c. Call `TimelineCompiler.compile(creative, assets, audio, brandStyle, format)`
     d. Save `Composition` with: payload (compiled schema), creative (AI output), caption, hashtags, format, status = 'draft' or 'approved' (based on persona.autoApproveCompositions)
     e. Update idea status to `USED`
     f. Call `AssetCurator.commitAssetUsage()` for all selected assets
  3. Return results summary
- [x] **Delete `src/modules/video/agent.ts`** — the composeVideoWithAgent() and generateContentIdeas() functions are now fully replaced
- [x] Update `/api/agent/compose` route to use the new pipeline (this is the manual compose trigger from the dashboard)

### 2.10 — Testing

- [ ] Write unit test: `TimelineCompiler` produces valid schema for various scene counts (3, 5, 7 scenes)
- [ ] Write unit test: `TimelineCompiler` handles missing audio (uses default 15s duration)
- [ ] Write unit test: `AssetCurator` excludes assets shorter than required duration
- [ ] Write unit test: `AssetCurator` returns null when no assets match (doesn't crash)
- [ ] Write unit test: `resolveModelId()` handles all AIModel enum values
- [ ] Write integration test: Full pipeline (mock AI) → Composition with valid payload

---

## Verification Criteria

1. **Build + type-check pass:** `npm run build && npm run type-check` — zero errors
2. **Tests pass:** All new unit tests + existing tests pass
3. **100% valid compositions:** Run the composer cron with 10 test ideas → verify all 10 produce compositions with valid `DynamicCompositionSchema` payloads (0 Zod validation failures)
4. **No black frames:** For every composition, verify that all media tracks have `durationInFrames` ≤ the resolved asset's duration in frames
5. **Asset diversity:** Run 10 compositions for the same account → verify at least 3 different video assets are used (no single-asset domination)
6. **Agent.ts deleted:** The old `composeVideoWithAgent()` function no longer exists in the codebase
7. **Dashboard still works:** Manual compose from dashboard produces valid compositions using the new pipeline
# Phase 3 — Render Infrastructure

> **Objective:** Decouple rendering from the app container. Build a dedicated render worker that processes a job queue, uploads to R2, and handles retries with asset re-selection.

---

## Objectives

1. Create the dedicated renderer Docker container
2. Implement the BullMQ render job queue
3. Build the render worker (picks jobs → renders → uploads)
4. Support both `renderMedia` (video) and `renderStill` (images)
5. Implement retry logic with asset re-selection on failure
6. Wire the composer cron to create render jobs instead of inline rendering
7. Update the publisher cron to only publish rendered content

---

## Tasks

### 3.1 — BullMQ Queue Setup

- [x] Add `bullmq` dependency to `package.json`
- [x] Create `src/modules/renderer/render-queue.ts`:
  - Export `renderQueue`: BullMQ Queue instance connected to `flownau_redis`
  - Export `addRenderJob(compositionId: string, priority?: number): Promise<Job>`
  - Export `getRenderJobStatus(compositionId: string): Promise<RenderJobStatus>`
  - Queue name: `flownau:render`
  - Default job options: `{ attempts: 3, backoff: { type: 'exponential', delay: 30000 } }`
  - Connection uses `REDIS_URL` env var

### 3.2 — Render Worker

- [x] Create `src/modules/renderer/render-worker.ts`:
  - BullMQ Worker that processes `flownau:render` queue
  - **For each job:**
    1. Fetch `Composition` from DB (with payload and account info)
    2. Create/update `RenderJob` record (status: 'rendering')
    3. Determine render type from `composition.format`:
       - `reel` | `trial_reel` → `renderMedia` (video)
       - `carousel` → `renderStill` × N (one per scene)
       - `single_image` → `renderStill` × 1
    4. Bundle Remotion entry point
    5. Render with resource-conscious settings:
       ```
       concurrency: 2
       jpegQuality: 80
       codec: 'h264'
       ```
    6. Upload output to R2 under `{account.username}/outputs/{compositionId}.mp4`
    7. For carousels: upload each slide as `{compositionId}_slide_{N}.png`
    8. Update `RenderJob`: status = 'done', outputUrl = R2 URL
    9. Update `Composition`: videoUrl = public URL, status = 'rendered'
  - **Error handling:**
    - On render failure: log error, update `RenderJob.error`
    - On retry (attempt > 1): re-select assets via `AssetCurator` before re-rendering
    - After max attempts: mark `RenderJob` and `Composition` as 'failed'
  - **Progress reporting:** Use BullMQ's `job.updateProgress()` during render

- [x] Create `src/modules/renderer/render-entry.tsx` (using existing remotion/index.tsx as entry):
  - Remotion `registerRoot` for the renderer container
  - Register `SceneSequenceComposition` (from Phase 2)
  - Register `DynamicTemplateMaster` (backward compat)
  - This is the entry point that the renderer bundles

### 3.3 — Still Renderer (for Images/Carousels)

- [x] Create `src/modules/renderer/still-renderer.ts`:
  - **Function:** `renderSlide(sceneComponent, sceneProps, brandStyle, outputPath): Promise<void>`
  - Uses Remotion's `renderStill()` API
  - Renders a single scene as a PNG/JPEG image
  - Dimensions: 1080×1350 (carousel default) or 1080×1080 (square)
  - **Function:** `renderCarousel(scenes, brandStyle, outputDir): Promise<string[]>`
  - Renders all slides sequentially, returns array of file paths
  - Each slide is rendered independently (no timeline/frame concerns)

### 3.4 — Cover Image Extraction

- [x] Implement cover image extraction in the render worker:
  - After video render completes, extract the cover frame:
    - Use `renderStill()` with `frame` set to the scene at `creative.coverSceneIndex`
    - Upload as `{compositionId}_cover.jpg` to R2
    - Store URL in `Composition.coverUrl`
  - This cover image is used as the reel thumbnail on Instagram

### 3.5 — Renderer Dockerfile

- [x] Create `Dockerfile.renderer`:
  ```
  FROM node:20-slim
  RUN apt-get update && apt-get install -y chromium ffmpeg && rm -rf /var/lib/apt/lists/*
  ENV CHROME_PATH=/usr/bin/chromium
  ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --omit=dev
  COPY . .
  RUN npx prisma generate
  CMD ["node", "dist/modules/renderer/render-worker.js"]
  ```
  - Note: The renderer needs its own build step. Create a separate tsconfig or use `tsx` runtime.
  - Alternative approach: use `tsx` to run TypeScript directly:
    ```
    CMD ["npx", "tsx", "src/modules/renderer/render-worker.ts"]
    ```

### 3.6 — Docker Compose Update

- [x] Update `docker-compose.yml` to add the renderer service (as specified in PLAN.md F)
- [ ] Test locally: `docker compose up -d` starts app + renderer + postgres + redis
- [ ] Verify renderer container starts, connects to Redis, and begins polling for jobs

### 3.7 — Wire Composer → Render Queue

- [x] Update the composer cron (`/api/cron/composer`):
  - After creating a Composition, if status is 'approved':
    - Create a `RenderJob` record (status: 'queued')
    - Add job to BullMQ render queue via `addRenderJob(compositionId)`
    - Update Composition status to 'rendering'

### 3.8 — Update Publisher Cron

- [x] Refactor `/api/cron/publisher` route:
  - **Part A (Explicit Scheduling):** Only process compositions where:
    - `status = 'rendered'` (was 'rendered' by the render worker)
    - `scheduledAt <= now`
    - Publishing attempts < 3
  - **Part B (Auto-Posting):** Only process compositions where:
    - `status = 'rendered'`
    - PostingSchedule is due
  - Remove all inline rendering logic (the `renderAndUpload()` call is gone)
  - The publisher now ONLY handles Instagram API calls

### 3.9 — GitHub Actions Update

- [x] Update `.github/workflows/deploy.yml`:
  - Build both `app` and `renderer` Docker images
  - Push both to GHCR
  - Tag both with same version tag
  - The compose file pulls both images

---

## Verification Criteria

1. **Renderer starts independently:** `docker compose up renderer` starts, connects to DB + Redis, logs "Render worker ready"
2. **Queue round-trip:** Create a test RenderJob via BullMQ → renderer picks it → processes → marks done
3. **Video render:** Submit a composition with 5 scenes → renderer produces valid MP4 → uploads to R2 → public URL is accessible
4. **Still render:** Submit a single_image composition → renderer produces valid PNG → uploads to R2
5. **Cover extraction:** After video render, cover image exists at `Composition.coverUrl` and is accessible
6. **Retry works:** Simulate render failure (invalid asset URL) → renderer retries with different asset → succeeds on retry
7. **Publisher decoupled:** Publisher cron ONLY publishes `rendered` compositions — never triggers a render
8. **Resource limits:** Renderer stays within 1.5GB memory during render (verify with `docker stats`)
9. **GHA deploys both:** Push to main → GHA builds and pushes both `app` and `renderer` images
# Phase 4 — Multi-Format Publishing & Trial Reels

> **Objective:** Extend the publishing pipeline to support Trial Reels, Carousel posts, and Single Image posts on Instagram. After this phase, flownaŭ can publish all four content formats fully automated.

---

## Objectives

1. Implement Trial Reels publishing (trial_params API)
2. Build image scene components for carousels
3. Implement Instagram Carousel publishing (multi-container API)
4. Implement Instagram Photo publishing (single image)
5. Build a unified publish orchestrator that routes content to the correct publisher
6. Implement Instagram token auto-refresh
7. Extend schedule system with time-of-day slots

---

## Tasks

### 4.1 — Publisher Module Refactor

- [ ] Create `src/modules/publisher/instagram-reels.ts`:
  - Migrate and enhance logic from `src/modules/accounts/instagram.ts`
  - **Function:** `publishReel(params: { accessToken, igUserId, videoUrl, caption, coverUrl? }): Promise<PublishResult>`
  - Implements the existing 3-step flow: create container → poll status → publish
  - Add cover image support: pass `cover_url` parameter to container creation
  - Add `share_to_feed=true` parameter
  - Robust error handling with descriptive error messages

- [ ] Create `src/modules/publisher/instagram-trial-reels.ts`:
  - **Function:** `publishTrialReel(params: { accessToken, igUserId, videoUrl, caption, trialParams }): Promise<PublishResult>`
  - Same flow as reels but includes `trial_params` in container creation:
    ```typescript
    {
      video_url: videoUrl,
      media_type: 'REELS',
      caption: caption,
      access_token: accessToken,
      trial_params: JSON.stringify({
        graduation_strategy: 'auto' // or 'manual'
      })
    }
    ```
  - Graduation strategy is configurable per brand (stored in SocialAccount or PostingSchedule)

- [ ] Create `src/modules/publisher/instagram-carousel.ts`:
  - **Function:** `publishCarousel(params: { accessToken, igUserId, imageUrls: string[], caption }): Promise<PublishResult>`
  - **Multi-step flow:**
    1. For each image URL: `POST /{igUserId}/media` with `image_url` + `is_carousel_item=true`
    2. Collect all `creation_id` values
    3. Create parent carousel container: `POST /{igUserId}/media` with `media_type=CAROUSEL` + `children={ids}`
    4. Poll parent container status until FINISHED
    5. Publish: `POST /{igUserId}/media_publish`
  - Handle rate limits: max 100 posts per 24h per account

- [ ] Create `src/modules/publisher/instagram-photo.ts`:
  - **Function:** `publishPhoto(params: { accessToken, igUserId, imageUrl, caption }): Promise<PublishResult>`
  - Standard single-image post flow
  - Include alt_text parameter for accessibility

- [ ] Create `src/modules/publisher/publish-orchestrator.ts`:
  - **Function:** `publishComposition(composition: Composition): Promise<PublishResult>`
  - Routes to correct publisher based on `composition.format`:
    - `'reel'` → `publishReel()`
    - `'trial_reel'` → `publishTrialReel()`
    - `'carousel'` → `publishCarousel()`
    - `'single_image'` → `publishPhoto()`
  - Handles common pre-publish steps: token validation, URL resolution
  - Returns standardized `PublishResult` type

- [ ] Create `src/modules/publisher/types.ts`:
  - `PublishResult: { success: boolean, externalId?: string, permalink?: string, error?: string }`

### 4.2 — Image Scene Components (Carousel)

- [ ] Create `src/modules/scenes/image/CoverSlide.tsx`:
  - Visual: Large title + optional subtitle
  - Brand gradient background
  - Centered, bold typography
  - 1080×1350px

- [ ] Create `src/modules/scenes/image/ContentSlide.tsx`:
  - Visual: Heading + body text
  - Clean layout with heading at top, body in center
  - Optional accent line/dot separator
  - 1080×1350px

- [ ] Create `src/modules/scenes/image/QuoteSlide.tsx`:
  - Visual: Stylized quote with decorative elements
  - Large quotation marks, centered text
  - Attribution at bottom
  - 1080×1350px

- [ ] Create `src/modules/scenes/image/ListSlide.tsx`:
  - Visual: Title + numbered/bulleted list
  - Clean spacing, accent-colored numbers
  - 1080×1350px

- [ ] Create `src/modules/scenes/image/CTASlide.tsx`:
  - Visual: Call to action + brand handle
  - "Follow for more" or custom CTA
  - Brand colors, centered layout
  - 1080×1350px

- [ ] Update Scene Registry (`scene-registry.ts`) to include image scene types

### 4.3 — SceneComposer Extension

- [ ] Update `SceneComposer` to handle carousel and single_image formats:
  - For `carousel`: AI composes 5-10 image scenes (cover → content × N → CTA)
  - For `single_image`: AI composes 1 image scene
  - Scene type catalog dynamically filtered by format (video scenes for reels, image scenes for carousels)

### 4.4 — Instagram Token Auto-Refresh

- [ ] Create `src/modules/publisher/instagram-token.ts`:
  - **Function:** `refreshTokenIfNeeded(account: SocialAccount): Promise<string>`
    1. Check `account.tokenExpiresAt`
    2. If expires within 7 days → refresh via `GET /oauth/access_token?grant_type=fb_exchange_token`
    3. Update `accessToken`, `tokenExpiresAt`, `tokenRefreshedAt` in DB
    4. Return valid access token
  - **Function:** `checkAllTokens(): Promise<TokenCheckResult[]>`
    - Called by a cron or daily plan generation
    - Returns list of accounts with expiring tokens (for alerts)
  - Add cron endpoint: `GET /api/cron/token-refresh` — runs daily, refreshes any token expiring within 7 days

### 4.5 — Posting Schedule Enhancement

- [ ] Extend `PostingSchedule` model with time-of-day slots:
  ```prisma
  model PostingSchedule {
    id              String   @id @default(cuid())
    accountId       String   @unique
    reelsPerDay     Int      @default(5)
    trialReelsPerDay Int     @default(5)
    carouselsPerWeek Int     @default(0)     // Future: carousel frequency
    postingTimes    Json     @default("[]")  // Array of HH:MM strings: ["10:00","13:00","16:00","19:00","21:00"]
    trialPostingTimes Json  @default("[]")  // Separate times for trial reels
    timezone        String   @default("Europe/Madrid")
    lastPostedAt    DateTime?
    account         SocialAccount @relation(...)
  }
  ```
- [ ] Update publisher cron to schedule compositions at specific times:
  - For each due account, assign `scheduledAt` timestamps from `postingTimes` array
  - Trial reels get `trialPostingTimes`
  - Compositions are marked `scheduled` with the next available time slot

### 4.6 — Update Publisher Cron

- [ ] Refactor `/api/cron/publisher` route to use `publish-orchestrator.ts`
- [ ] Add token refresh check before every publish attempt
- [ ] Log publish results with composition ID, format, and duration metrics
- [ ] Implement rate limit awareness: track publications per account per 24h, skip if at limit

### 4.7 — Delete Legacy Publisher Code

- [ ] Delete `src/modules/accounts/instagram.ts` (fully replaced by `publisher/` module)
- [ ] Remove old `publishVideoToInstagram` imports throughout codebase

---

## Verification Criteria

1. **Trial Reel publishes:** Submit a trial_reel composition → successfully published to IG with trial_params → visible only to non-followers
2. **Carousel publishes:** Submit a carousel composition (5 slides) → all slides uploaded → carousel published as single post
3. **Single image publishes:** Submit a single_image composition → photo published to IG
4. **Standard reel still works:** Existing reel pipeline continues to function
5. **Token refresh:** Set up an account with token expiring in 5 days → cron refreshes it → new token stored
6. **Posting times:** Schedule with times ["10:00","14:00","18:00"] → compositions are scheduled at those times (in correct timezone)
7. **Rate limiting:** Account at 98 posts for the day → publisher skips remaining, logs "rate limit approaching"
8. **Orchestrator routing:** Each format routes to its correct publisher (no cross-contamination)
# Phase 5 — Content Plan & Platform Integration

> **Objective:** Implement the daily content plan system, deliver it via Zazŭ, enable reactive content triggers from other platform services, and wire the complete nauthenticity → flownaŭ ideation pipeline.

---

## Objectives

1. Build the daily content plan generation engine
2. Expose the plan via `/api/v1/daily-plan` endpoint
3. Implement "head talk" script generation (face-to-camera recording prompts)
4. Wire Zazŭ integration (daily Telegram delivery)
5. Implement reactive composition triggers from 9naŭ API
6. Connect nauthenticity InspoItems as an ideation source
7. Implement content diversity tracking

---

## Tasks

### 5.1 — Daily Plan Generation

- [x] Create `src/modules/planning/daily-plan.service.ts`:
  - **Function:** `generateDailyPlan(accountId: string, date: Date): Promise<ContentPlan>`
  - **Logic:**
    1. Check existing `ContentPlan` for this account + date (idempotent)
    2. Count how many compositions exist for today:
       - Already published
       - Already scheduled
       - Already rendered and awaiting scheduling
       - In draft requiring approval
    3. Calculate how many more pieces are needed:
       - `reelsNeeded = schedule.reelsPerDay - existingReels`
       - `trialReelsNeeded = schedule.trialReelsPerDay - existingTrialReels`
    4. If more pieces are needed, check if there are approved ideas available
    5. Generate composition summary for each planned piece:
       - `{ id, format, status, scheduledAt, caption (preview), sceneSummary }`
    6. Check for ideas that require "head talk" recording:
       - Ideas where the AI recommended face-to-camera format
       - Generate recording scripts for these
    7. Save/update `ContentPlan` record

  - **Function:** `getHeadTalkScripts(accountId: string): Promise<Script[]>`
    - Returns pending recording scripts for the account
    - Each script has: hook, body, estimatedDuration, tone notes
    - Scripts are marked as "recorded" when the user provides the recording via dashboard or echonau

### 5.2 — Head Talk Script Generation

- [x] Extend `SceneComposer` with format detection:
  - When an idea clearly calls for face-to-camera content (e.g., "explain", "react to", "hot take", "unpopular opinion"):
    - Set `format = 'reel'` but add `requiresRecording = true` flag
    - Generate a complete recording script:
      ```typescript
      {
        hook: "Opening line to say on camera",
        body: "Key talking points (bulleted)",
        cta: "What to say at the end",
        estimatedDuration: "~45s",
        tone: "energetic, direct, conversational",
        notes: "Look at camera. No B-roll — this is authentic head talk."
      }
      ```
    - These ideas are NOT auto-composed — they go into the content plan as "scripts to record"
  - **Detection logic:** Check for keywords in the idea text that suggest talking-head content: "react", "response", "opinion", "explain", "story time", "hot take", "my take", "unpopular opinion"
  - If detected: generate script and hold for recording instead of auto-composing with B-roll

### 5.3 — v1 API Implementation

- [x] Implement `GET /api/v1/daily-plan/[accountId]/route.ts`:
  - Auth: NAU_SERVICE_KEY
  - Calls `generateDailyPlan()` if no plan exists for today
  - Returns the contract defined in PLAN.md C.3
  - Includes pieces summary, recording scripts, and stats

- [x] Implement `POST /api/v1/compose/route.ts`:
  - Auth: NAU_SERVICE_KEY
  - Accepts: `{ accountId, prompt, format?, source?, sourceRef?, autoApprove? }`
  - Creates a `ContentIdea` from the prompt
  - If `autoApprove`: immediately runs SceneComposer → TimelineCompiler → creates Composition
  - Returns: `{ compositionId, status }`
  - This is the reactive trigger endpoint for 9naŭ, echonau, and Zazŭ

- [x] Implement `POST /api/v1/ideas/ingest/route.ts`:
  - Auth: NAU_SERVICE_KEY
  - Accepts: `{ accountId, ideas: [{ text, source, sourceRef? }], autoApprove? }`
  - Bulk creates `ContentIdea` records
  - Returns: `{ created, ids }`

- [x] Implement `GET /api/v1/accounts/route.ts`:
  - Auth: NAU_SERVICE_KEY
  - Returns list of social accounts with basic info (id, username, platform)
  - Used by Zazŭ to resolve account IDs

- [x] Implement `GET /api/v1/compositions/route.ts`:
  - Auth: NAU_SERVICE_KEY
  - Query params: `accountId`, `status`, `format`, `limit`
  - Returns filtered compositions list

### 5.4 — nauthenticity Integration

- [x] Create `src/modules/ideation/sources/inspo-source.ts`:
  - **Function:** `fetchInspoItems(accountId: string): Promise<InspoItem[]>`
  - Calls nauthenticity: `GET ${NAUTHENTICITY_URL}/api/v1/content/search`
  - Auth: NAU_SERVICE_KEY header
  - Maps nauthenticity's InspoItems to flownaŭ's ideation input format
  - **Graceful degradation:** If nauthenticity is unreachable, return empty array + log warning
  - Timeout: 10 seconds max

- [x] Create `src/modules/ideation/sources/brand-dna-source.ts`:
  - **Function:** `getBrandDNA(accountId: string): Promise<string>`
  - Fetches BrandPersona.systemPrompt for the account
  - This is the fallback ideation source when InspoItems are unavailable

- [x] Create `src/modules/ideation/sources/external-source.ts`:
  - **Function:** `ingestExternalIdea(params: { accountId, text, source, sourceRef }): Promise<ContentIdea>`
  - Creates a ContentIdea from external input (9naŭ API triage, Zazŭ, manual)
  - Validates input, prevents duplicates (check for similar ideaText in last 7 days)

- [x] Update `ideation.service.ts`:
  - Use the source adapters: try InspoItems first, fall back to Brand DNA only
  - Include recent content history (last 14 days) to prevent repetition
  - Include external ideas as additional context

### 5.5 — Content Diversity Tracking

- [x] Add tracking fields to `Composition`:
  ```prisma
  sceneTypes     String[]  @default([])  // Scene types used in this composition
  topicHash      String?                 // Hash of main topic for dedup
  ```
- [x] Before composing a new piece, query recent compositions (last 14 days):
  - Extract `sceneTypes` distribution
  - Pass to SceneComposer as "avoid overusing these patterns" context
  - Extract recent `caption` snippets as "avoid these topics" context
- [x] The AI receives this diversity context and adjusts its output accordingly

### 5.6 — Daily Plan Cron

- [x] Create `GET /api/cron/daily-plan/route.ts`:
  - Runs daily at configured evening hour (default 22:00)
  - For each active account:
    1. Generate tomorrow's content plan
    2. Check for expiring IG tokens (alert if within 7 days)
    3. Check for low asset pool (alert if < 5 unused video assets)
  - Store plans in `ContentPlan` table

### 5.7 — Zazŭ Delivery Contract

> Note: Zazŭ implementation is in the zazŭ repository. This section defines what flownaŭ exposes.

- [x] Ensure `/api/v1/daily-plan/:accountId` returns data in the format Zazŭ expects:
  ```typescript
  {
    date: "2026-04-13",
    accountUsername: "@karenexplora",
    pieces: [
      { format: "reel", caption: "3 señales de que...", scheduledAt: "10:00", status: "rendered" },
      { format: "trial_reel", caption: "Hot take: Los signos...", scheduledAt: "11:00", status: "rendering" },
      // ...
    ],
    scripts: [
      { hook: "¿Sabías que tu signo...", body: "...", estimatedDuration: "~45s", tone: "casual" }
    ],
    alerts: [
      { type: "token_expiring", message: "IG token expires in 5 days", severity: "warning" },
      { type: "low_assets", message: "Only 3 unused video assets remaining", severity: "info" }
    ],
    stats: { total: 10, rendered: 7, published: 0, pending: 3 }
  }
  ```
- [x] Add a morning reminder endpoint: `GET /api/v1/daily-plan/:accountId?reminder=true`
  - Returns a condensed version with only today's pending items
  - Zazŭ calls this at morning hour for the reminder message

### 5.8 — Ideation Cron Enhancement

- [x] Update `GET /api/cron/ideation`:
  - For each active account with ideation enabled:
    1. Fetch InspoItems from nauthenticity (graceful degradation)
    2. Fetch Brand DNA
    3. Fetch recent content history (diversity tracking)
    4. Generate ideas using `ideation.service.ts`
    5. Auto-approve ideas if persona has `autoApproveIdeas` enabled
    6. Detect head-talk ideas → generate scripts → hold for recording
  - Run frequency: per-account configuration (daily default)

---

## Verification Criteria

1. **Daily plan generates:** Call `/api/v1/daily-plan/:accountId` → returns plan with pieces, scripts, and stats
2. **Reactive trigger works:** `POST /api/v1/compose` with valid payload → creates composition → returns ID
3. **Ideas ingest works:** `POST /api/v1/ideas/ingest` with 5 ideas → creates 5 ContentIdea records
4. **nauthenticity integration:** With nauthenticity running → ideation pulls InspoItems. Without → gracefully falls back to Brand DNA only
5. **Head talk detection:** Idea "My hot take on Mercury retrograde" → generates recording script instead of auto-composing
6. **Diversity tracking:** After 10 compositions, the 11th avoids overused scene patterns
7. **Token alerts:** Account with token expiring in 5 days → daily plan includes token_expiring alert
8. **Asset alerts:** Account with 3 unused video assets → daily plan includes low_assets alert
9. **NAU_SERVICE_KEY auth:** All `/api/v1/*` endpoints return 401 without valid key, 200 with valid key
10. **Zazŭ contract:** Daily plan response matches the exact schema defined in 5.7
