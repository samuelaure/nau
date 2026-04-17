# Flownaŭ Architecture Overview

## 1. System Overview
Flownaŭ is a headless media composition engine and orchestration platform. It is designed to consume textual content ideas and context, generate fully realized short-form video or image carousels via generative AI, deterministically render them via Remotion, and autonomously publish them to Instagram.

### Core Stack
- **Web App / API:** Next.js 15 (App Router), deployed via standalone Docker container.
- **Database:** PostgreSQL (managed via Prisma).
- **Caching & Job Queue:** Redis (managed via BullMQ & ioredis).
- **Renderer:** Custom Remotion Worker. Scales independently from the API server.
- **Object Storage:** Cloudflare R2 for final render artifacts and source assets.

## 2. The Content Pipeline

Data flows through a strict state machine, transitioning across several specialized domain modules.

```text
       [External Ingress]       [AI Ideation Engine]
              │                          │
              ▼                          ▼
       (1) ContentIdea <──────── (2) Pending/Approved
              │
              ▼
   [Composer Cron] (Picks up APPROVED ideas)
              │
              ├─► SceneComposer     (Generates JSON CreativeDirection)
              ├─► AssetCurator      (Matches R2 Assets to Scene tags)
              └─► TimelineCompiler  (Outputs determininstic DynamicCompositionSchema)
              │
              ▼
       (3) Composition (Saved to DB as queued)
              │
              ▼
   [BullMQ Render Queue] (Redis)
              │
              ▼
       [RenderWorker] (Executes `npx remotion render`)
              │
              ▼
     (4) RenderJob (Status: 'completed' + R2 upload)
              │
              ▼
       (5) Publisher Cron
              │
              ▼
   [PublishOrchestrator] (Graph API execution based on DailyPlan scheduling)
```

## 3. Module Boundaries
Flownaŭ is divided into bounded contexts (modules) to prevent spaghetti integration. 

| Module | Core Responsibility | Does NOT Own |
|--------|---------------------|--------------|
| **Accounts** | Core workspace auth, settings, multi-tenancy. | Composition execution logic. |
| **Ideation** | LLM wrapper to ingest trends/DNA and output `ContentIdea`s. | Template selection, video generation. |
| **Composer** | Assembles JSON payloads (Creative Direction + Asset Selection). | Actual pixel rendering or rendering libraries. |
| **Renderer** | Remotion environment, BullMQ queue handling. | Ideation or Instagram constraints. |
| **Publisher** | API interfacing with Instagram Graph (OAuth, Reels, Carousels). | Content design or asset generation. |
| **Shared** | `prisma`, `logger`, `rate-limit`, `env-validation`. | Domain-specific logic. |

## 4. External Dependency Constraints

### Instagram Graph API (Publisher)
- Long-lived User Access Tokens expire every 60 days.
- Flownaŭ runs a daily cron (`api/cron/token-refresh`) holding a distributed redis lock to proactively renew these tokens if they are <= 7 days from expiry. 
- Strict limit of 50 API calls per hour per user account, and exactly 25 Reel publish limits per 24 hours.

### AI Constraints (Composer / Ideation)
- Both OpenAI and Groq APIs are subject to arbitrary network drops. The `SceneComposer` relies on a strict internal single-retry threshold.
- To prevent abuse of the `/api/agent/compose` hook, sliding-window rate limits (Redis) restrict synchronous composing to 10 requests per minute per IP/account.

### Local Assets
- Assets mapped to compositions are hard-referenced by `asset.url`. The `AssetCurator` performs validation against these URLs before locking the `TimelineCompiler`.
