# Service — nauthenticity

- **Domain:** `nauthenticity.9nau.com`
- **Role:** Brand intelligence. Instagram scraping, transcription, semantic search, benchmark chat, InspoBase, comment suggestions.
- **Stack (target):** NestJS · Prisma · PostgreSQL + pgvector · Redis · BullMQ · Apify
- **Owned entities:** `Post`, `Media`, `Transcript`, `Embedding` (or future `KnowledgeChunk`), `ScrapingRun`, `InspoItem`, `BrandSynthesis`, `CommentFeedback`
- **References:** `brandId`, `socialProfileId` (from 9naŭ API). Scraped content keyed by `(platform, platformId)` for dedup across brands monitoring the same profile.

---

## Responsibilities

1. **Scraping** — Apify actor for Instagram; extensible to TikTok, YouTube in future.
2. **Transcription** — whisper-service (self-hosted) for video audio → text.
3. **Embedding** — OpenAI text-embedding-3-small → pgvector.
4. **Semantic search** — RAG over brand content and benchmarked profile content.
5. **InspoBase** — user-captured inspiration items, linked to posts, with extracted hooks/themes.
6. **Brand synthesis** — AI-generated pattern/theme extraction per brand.
7. **Comment suggestions** — reactive (single post) and proactive (monitored profiles).
8. **Benchmark chat** — "talk with a profile's data" via pgvector retrieval.

---

## URL surface

See [../platform/API-CONTRACT.md §4](../platform/API-CONTRACT.md#4-nauthenticity9naucom--brand-intelligence).

---

## Key conventions

- API routes under `/api/v1/*`.
- Dashboard SPA served at `/`.
- Auth via `@nau/auth`:
    - User routes: `JwtAuthGuard` (cookie or Bearer).
    - Service routes: `ServiceAuthGuard` (per-caller JWT).
- Queues:
    - `ingestion.queue` — new InspoItems / captures
    - `download.queue` — Apify scrape jobs
    - `compute.queue` — transcription + embedding
    - `optimization.queue` — periodic re-ranking / re-embedding

---

## Dependencies

- **9naŭ API** — brand/profile/prompt lookups, auth.
- **Apify** — Instagram scraping.
- **whisper-service** — local transcription (local dev) / OpenAI Whisper (prod).
- **OpenAI** — embeddings + LLM calls for synthesis and chat.
- **zazu-bot** — proactive comment suggestion delivery (publish to zazu).

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres (pgvector extension enabled) |
| `REDIS_URL` | Yes | Redis / BullMQ |
| `AUTH_SECRET` | Yes (HS256 phase) | JWT verification |
| `NAUTHENTICITY_SERVICE_SECRET` | Yes | Signs outgoing service JWTs |
| `NAU_API_URL` | Yes | 9naŭ API base |
| `OPENAI_API_KEY` | Yes | Embeddings + LLM |
| `APIFY_TOKEN` | Yes | Scraping |
| `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET_NAME` | Yes | Media storage |
| `FRONTEND_URL` | No | CORS allowlist |

---

## Scraped content deduplication

Key design:

- `Post`, `Media`, `Transcript` are keyed by `(platform, platformId)`.
- `InspoItem`, `BrandSynthesis`, `CommentFeedback` are keyed by `brandId`.

Multiple brands can monitor `@nike` via `SocialProfile` rows (one per brand × role). All share the underlying scraped `Post` rows — scrape once, deduped at content layer.

Orphan cleanup (post deletion cascade): periodic job identifies `Post` rows not referenced by any active `SocialProfile` and archives to cold storage.

---

## Status

🟡 Pre-refactor — currently Fastify. Migration to NestJS in Phase 5 of the [roadmap](../future/ROADMAP.md). Schema simplification (drop `BrandIntelligence`, `BrandTarget`, `IgProfile`) also in Phase 5.

## Related

- [../features/brand-intelligence.md](../features/brand-intelligence.md)
- [../features/comment-suggester.md](../features/comment-suggester.md)
- [../future/rag-knowledge-base.md](../future/rag-knowledge-base.md)
- [../decisions/ADR-006-nestjs-on-nauthenticity.md](../decisions/ADR-006-nestjs-on-nauthenticity.md)
