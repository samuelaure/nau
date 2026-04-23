# SERVICE MAP — NAŬ Platform Ecosystem

> **Living Document.** Update this file whenever a service's API surface changes.  
> Last Updated: 2026-04-07

---

## Network Topology

```
                        ┌─────────────────────────────────────────────────────┐
                        │              nau-network (Docker Network)            │
                        │                    Traefik Gateway                  │
                        └────────────────────────┬────────────────────────────┘
                                                 │
              ┌──────────────┬──────────────┬────┴──────────────┬─────────────┐
              │              │              │                   │             │
       ┌──────▼─────┐ ┌──────▼──────┐ ┌────▼──────┐   ┌───────▼──────┐ ┌────▼──────┐
       │  flownau   │ │nauthenticity│ │  whatsnau │   │  komunikadoj │ │   zazu   │
       │  :3000     │ │  :3000      │ │  :3000    │   │   :3000      │ │  :3000   │
       └──────┬─────┘ └──────┬──────┘ └─────┬─────┘   └──────┬───────┘ └────┬──────┘
              │              │              │                  │              │
         ┌────▼────┐   ┌─────▼────┐   ┌────▼────┐        ┌───▼─────┐   ┌────▼────┐
         │Postgres │   │Postgres  │   │Postgres │        │Postgres │   │Postgres │
         │  Redis  │   │  Redis   │   │  Redis  │        │         │   │         │
         └─────────┘   └──────────┘   └─────────┘        └─────────┘   └─────────┘

                                          ▲
    ┌─────────────────────────────────────┤
    │               Consumers             │
    │  ┌──────────────┐  ┌────────────┐  │
    │  │  nau-ig API  │  │  echonau  │  │
    │  │   (Phase 3)  │  │  Python   │  │
    │  └──────────────┘  └────────────┘  │
    └────────────────────────────────────┘

                    ┌─────────────┐
                    │whisper-svc  │   Shared, called by nauthenticity + echonau
                    │  :9000     │
                    └─────────────┘
```

---

## Service Directory

### 🟢 ACTIVE PLATFORM SERVICES

#### `flownau`
| Field | Value |
|-------|-------|
| Role | Content composition engine, rendering & Instagram publishing |
| Local URL | `http://flownau:3000` (Docker) / `http://localhost:3001` |
| Production URL | `https://flownau.9nau.com` |
| Stack | Next.js 15, Prisma, PostgreSQL, Redis/BullMQ, Remotion 4, OpenAI, Groq |
| Auth | NextAuth (UI) + `NAU_SERVICE_KEY` (API) |
| Database | `flownau-postgres` (isolated) |
| Renderer | `flownau-renderer` (dedicated container, 1.5GB, headless Remotion + FFmpeg) |
| **API Surface** | |
| `GET /api/v1/health` | Health check |
| `POST /api/v1/compose` | Trigger reactive composition (from 9naŭ, echonau, Zazŭ) |
| `POST /api/v1/ideas/ingest` | Bulk ingest content ideas from external sources |
| `GET /api/v1/daily-plan/:accountId` | Get daily content plan (pieces, scripts, alerts) |
| `GET /api/v1/accounts` | List linked social accounts |
| `GET /api/v1/compositions?accountId=&status=` | Query compositions by account and status |
| **Owned Domains** | Scene-based composition, Video/Image rendering, R2 assets, IG publishing (Reels, Trial Reels, Carousels, Photos), Content scheduling, Daily content plans |
| **Consumers** | Zazŭ (daily plans, compose), 9naŭ API (reactive triggers, idea ingest), nau-ig (future) |
| **Consumes** | nauthenticity (InspoItems, Brand DNA for ideation) |

---

#### `nauthenticity`
| Field | Value |
|-------|-------|
| Role | Instagram content intelligence & AI enrichment |
| Local URL | `http://nauthenticity:3000` (Docker) / `http://localhost:3002` |
| Production URL | `https://nauthenticity.9nau.com` |
| Stack | Node.js, Fastify, Prisma, PostgreSQL, Redis/BullMQ, Apify, pgvector |
| Auth | `NAU_SERVICE_KEY` |
| Database | `nauthenticity-postgres` (isolated, pgvector enabled) |
| **API Surface (Planned)** | |
| `POST /api/v1/scrape/post` | Scrape a single IG post URL |
| `POST /api/v1/scrape/profile` | Scrape an IG profile |
| `POST /api/v1/ingest/batch` | Bulk ingest by username |
| `GET /api/v1/content/search?q=` | RAG vector search |
| `GET /api/v1/content/:postId` | Get enriched post |
| **Owned Domains** | IG scraping via Apify, transcription pipeline, AI enrichment, vector embeddings |
| **Consumers** | nau-ig (Phase 1), zazu (Phase 5) |

---

#### `whatsnau`
| Field | Value |
|-------|-------|
| Role | WhatsApp CRM & sales campaign orchestration |
| Local URL | `http://whatsnau-backend:3000` / `http://localhost:3003` |
| Production URL | `https://whatsnau.9nau.com` |
| Stack | Node.js ESM, Turborepo, React/Vite (dashboard), Prisma, BullMQ |
| Auth | JWT (multi-tenant) |
| Database | `whatsnau-postgres` (isolated) |
| **API Surface** | WhatsApp webhook receiver, campaign API, agent dispatch (internal) |
| **Owned Domains** | WhatsApp messaging, CRM leads, campaign sequencing |
| **Consumers** | None currently — self-contained SaaS |

---

#### `kommuniakdoj`
| Field | Value |
|-------|-------|
| Role | 9NAŬ platform backend (NestJS CRUD) |
| Local URL | `http://komunikadoj:3000` / `http://localhost:3004` |
| Production URL | `https://api.9nau.com` |
| Stack | NestJS, Prisma, PostgreSQL |
| Auth | TBD — currently basic |
| Database | `9nau-postgres` (shared 9nau DB) |
| **Owned Domains** | 9NAŬ platform content (blocks), user model |
| **Consumers** | `9nau` web app |

---

#### `whisper-service`
| Field | Value |
|-------|-------|
| Role | Audio-to-text transcription (shared) |
| Local URL | `http://whisper:9000` / `http://localhost:9000` |
| Production URL | Local only (NOT deployed to VPS without GPU) |
| Stack | Docker (openai/whisper-asr-webservice) |
| Auth | `NAU_SERVICE_KEY` (to be added to middleware - Phase 4) |
| **API Surface** | |
| `POST /asr` | Accepts audio file → returns transcript JSON |
| `GET /health` | Health check |
| **Owned Domains** | Audio transcription |
| **Consumers** | `nauthenticity` (Phase 4), `echonau` (Phase 4) |

---

#### `web-chatbot-widget` (KarenBot)
| Field | Value |
|-------|-------|
| Role | Embeddable RAG chatbot for Karen Explora |
| Local URL | `http://karenbot:3000` / `http://localhost:3007` |
| Production URL | `https://karenbot.karenexplora.com` |
| Stack | Node.js, Docker |
| Auth | Widget key |
| **Owned Domains** | Karen Explora content RAG, lead capture |
| **Consumers** | `karenexplora-web` (embed script) |

---

### 🔵 ORCHESTRATION LAYER

#### `zazu`
| Field | Value |
|-------|-------|
| Role | Telegram bot gateway + personal automation hub |
| Local URL | `http://zazu:3000` / `http://localhost:3005` |
| Stack | Node.js, Telegraf, Prisma, Next.js (dashboard) |
| Auth | Telegram webhook | Admin guard by Chat ID |
| **Consumes (Phase 5)** | `nauthenticity` (search), `flownau` (publish), all services (health) |
| **Skills (Planned)** | search, publish, status, capture, CRM alerts |

---

#### `echonau`
| Field | Value |
|-------|-------|
| Role | Local voice-to-action pipeline |
| Stack | Python, Docker |
| Auth | Local only |
| **Consumes (Phase 4)** | `whisper-service` (transcription) |
| **Produces** | Structured markdown transcripts → flownau (content ingest) |

---

#### `n8n-local`
| Field | Value |
|-------|-------|
| Role | Visual workflow automation |
| Auth | n8n auth |
| **Integration** | Can call any Platform Service via webhook nodes |

---

### 🟡 PRODUCT APPS

| App | Consumers | Migration Phase |
|-----|-----------|----------------|
| `nau-ig` (mobile) | nauthenticity (Phase 1), flownau (Phase 2) | Active migration |
| `nau-ig` (web, new) | Same backend as mobile | Phase 3 |
| `andi-universo` | None | Standalone |
| `samuelaure-web` | None | Standalone |
| `karenexplora-web` | `web-chatbot-widget` | Embed only |
| `topic-roulette` | None currently | Future: flownau |
| `math-app` | None | Standalone PWA |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-07 | `nauthenticity` owns all IG scraping | Eliminates ApifyService duplication in nau-ig |
| 2026-04-07 | `flownau` owns all IG publishing | Centralizes Graph API complexity |
| 2026-04-07 | `whisper-service` owns transcription | Removes duplicate model loading |
| 2026-04-07 | No Kafka/RabbitMQ | BullMQ/Redis is sufficient; already used |
| 2026-04-07 | No monorepo migration | Poly-repo + nau-network is simpler and sufficient |
| 2026-04-07 | Express (not NestJS) for nau-ig backend | Thin orchestrator needs no DI framework overhead |
| 2026-04-12 | `flownau` v2: scene-based composition | Replaces free-form LLM JSON generation. AI fills slots, code assembles deterministically |
| 2026-04-12 | Dedicated render container for `flownau` | Decouples Remotion rendering (1.5GB) from app container (384MB). Prevents OOM |
| 2026-04-12 | `flownau` owns daily content plans | Content planning + recording scripts generated by flownaŭ, delivered via Zazŭ |
| 2026-04-12 | Multi-format publishing in `flownau` | Single pipeline for Reels, Trial Reels, Carousels, Single Images |
| 2026-04-12 | `flownau` consumes nauthenticity for ideation | InspoItems + Brand DNA feed the ideation engine. Graceful degradation if unavailable |

