# naŭ Platform — RAG Knowledge Base

> pgvector-backed retrieval-augmented generation (RAG) for brand chatbots and "talk-with-its-data" interfaces on monitored profiles.

**Status:** partial foundation exists (pgvector + `Embedding` on `Transcript` in nauthenticity). Generic `KnowledgeChunk` abstraction to be built.

---

## 1. Use cases

1. **Brand chatbot** — ask a chatbot questions about your brand's own content (posts, transcripts, syntheses, inspo). Useful for onboarding, strategy iteration, content review.
2. **Benchmark chat** — pick a monitored `SocialProfile` with `role=BENCHMARK_TARGET`, ask questions about that creator's content patterns, tone, themes. "What hooks does @nike use most?"
3. **InspoBase Q&A** — ask about your captured inspiration. "Show me all the hooks about morning routines."
4. **Platform-wide semantic search** — cross-brand search across all knowledge owned by a user's workspaces.

---

## 2. Why pgvector (not Pinecone / Weaviate / Qdrant)

Decision criteria for a solopreneur SaaS scaling to tens of thousands of users:

| Factor | pgvector | Pinecone / Weaviate / Qdrant |
|---|---|---|
| Operational overhead | Zero — already running Postgres | Another service to manage, monitor, pay for |
| Cost at low-mid scale (<100M vectors) | Included in DB cost | $70+/mo minimum |
| ACID across vectors + metadata | Yes (single DB) | No (eventual consistency across systems) |
| Query latency for 10K–10M vectors | Low ms | Low ms |
| Ecosystem | Native in Supabase, Neon, Render, Vercel Postgres | Requires client libraries |
| Scale ceiling | ~100M vectors on a single large PG instance | Purpose-built for 100M+ |

Supabase, Neon, OpenAI cookbook, and most Y-Combinator-era startups default to pgvector. Migrate to a dedicated vector DB only if hitting the ceiling — realistically 3+ years out given the platform's scale trajectory.

See [ADR-005-monorepo-consolidation.md](../decisions/ADR-005-monorepo-consolidation.md) for the broader "use the boring tech you already have" principle applied across the stack.

---

## 3. Proposed data model

### 3.1. Generic `KnowledgeChunk` (nauthenticity, future)

```prisma
model KnowledgeChunk {
  id          String            @id @default(cuid())

  // Who owns this chunk
  ownerType   ChunkOwnerType                  // BRAND | SOCIAL_PROFILE | WORKSPACE | PLATFORM
  ownerId     String                          // polymorphic

  // Where it came from
  sourceType  ChunkSourceType                 // POST | TRANSCRIPT | SYNTHESIS | INSPO | UPLOAD | TEMPLATE
  sourceId    String                          // e.g. Post.id, Transcript.id, InspoItem.id
  sourceUrl   String?                         // original URL if applicable

  // The payload
  content     String            @db.Text
  vector      Unsupported("vector(1536)")     // pgvector
  model       String            @default("text-embedding-3-small")

  // Metadata for filtering + scoring
  metadata    Json              @default("{}")  // e.g. { hashtags, hook, theme, ctaType, language }
  tokenCount  Int?
  createdAt   DateTime          @default(now())

  @@index([ownerType, ownerId])
  @@index([sourceType, sourceId])
}

enum ChunkOwnerType {
  PLATFORM
  WORKSPACE
  BRAND
  SOCIAL_PROFILE
}

enum ChunkSourceType {
  POST
  TRANSCRIPT
  SYNTHESIS
  INSPO
  CAPTION
  UPLOAD          // user-uploaded context doc
  TEMPLATE
  BRIEF
}
```

### 3.2. Replacing the current `Embedding` on `Transcript`

`KnowledgeChunk` supersedes the current one-to-one `Transcript → Embedding`. Migration approach:

- Backfill `KnowledgeChunk` rows from existing `Transcript + Embedding` with `sourceType=TRANSCRIPT`, `ownerType=SOCIAL_PROFILE`, `ownerId=socialProfileId`.
- Retain `Embedding` model temporarily; drop once consumers migrate.
- Add chunking for long transcripts (currently transcripts are 1 embedding each; for long videos, chunk at ~500 tokens for better retrieval).

---

## 4. Query pattern

### 4.1. Brand-scope search

```
User asks "What themes do my reels focus on?" in the brand dashboard chat.

1. embed(query) via OpenAI text-embedding-3-small
2. SQL:
   SELECT content, metadata
   FROM KnowledgeChunk
   WHERE ownerType = 'BRAND' AND ownerId = :brandId
     AND sourceType IN ('TRANSCRIPT', 'POST', 'SYNTHESIS')
   ORDER BY vector <=> $queryVector   -- cosine distance
   LIMIT 10
3. feed top-K into LLM with system prompt from Prompt table (type=SYSTEM, owner=BRAND or PLATFORM)
4. stream answer to UI
```

### 4.2. Monitored-profile-scope search

```
User asks "What hooks does @nike use in reels?" in benchmark chat UI.

1. embed(query)
2. SQL:
   SELECT content, metadata
   FROM KnowledgeChunk
   WHERE ownerType = 'SOCIAL_PROFILE' AND ownerId = :socialProfileId
     AND sourceType = 'TRANSCRIPT'
   ORDER BY vector <=> $queryVector
   LIMIT 10
3. optional: filter by metadata.hook IS NOT NULL
4. LLM call with domain prompt
```

### 4.3. Cross-brand workspace search

```
User asks "Show me all captions about morning routines across my brands."

1. embed(query)
2. SQL:
   SELECT content, metadata, ownerId AS brandId
   FROM KnowledgeChunk
   WHERE ownerType = 'BRAND'
     AND ownerId IN (:userBrandIds)
     AND sourceType IN ('POST', 'TRANSCRIPT')
   ORDER BY vector <=> $queryVector
   LIMIT 20
```

---

## 5. Indexing strategy

- **IVFFlat index** on `KnowledgeChunk.vector` with `lists = sqrt(rowcount)` (adjust periodically).
- **Hybrid search**: combine pgvector semantic distance with Postgres full-text search on `content` for keyword recall:

    ```sql
    SELECT id, content,
           (0.7 * (1 - (vector <=> $q)) + 0.3 * ts_rank(to_tsvector(content), plainto_tsquery($text))) AS score
    FROM KnowledgeChunk
    WHERE ...
    ORDER BY score DESC
    LIMIT 10;
    ```

- **Reranking** (optional Phase 2 of RAG): after pgvector retrieval, pass top-50 through a cross-encoder reranker (e.g. Cohere Rerank, OpenAI's `gpt-4o-mini` as a reranker prompt) to boost precision.

---

## 6. Chunking policy

| Source | Chunking rule |
|---|---|
| `POST` caption | 1 chunk per post (captions are short) |
| `TRANSCRIPT` | ~500-token chunks with 50-token overlap |
| `SYNTHESIS` | 1 chunk per synthesis (already condensed) |
| `INSPO` | 1 chunk per item (extractedHook + note combined) |
| `UPLOAD` | ~800-token chunks for long documents |
| `TEMPLATE` content | 1 chunk per template |

Chunking is re-runnable: on model upgrade (e.g., `text-embedding-3-large`), re-embed all chunks.

---

## 7. Storage + cost

At `text-embedding-3-small` (1536 dimensions, ~$0.02 per 1M tokens):

| Scale | Chunks | Est. storage | Est. embedding cost |
|---|---|---|---|
| Solopreneur onboarding | 1K | ~12 MB | < $0.01 |
| Power user (1 year) | 100K | ~1.2 GB | ~$2 |
| Team-of-5 over 2 years | 1M | ~12 GB | ~$20 |
| 10K-tenant SaaS | 100M | ~1.2 TB | ~$2K (one-off) |

At 100M vectors pgvector starts needing partitioning. Migration to Qdrant/Pinecone is documented at that threshold.

---

## 8. UX surfaces

| Surface | Backend | Frontend |
|---|---|---|
| Brand chatbot | nauthenticity `POST /api/v1/brands/:id/chat` | component in `app.9nau.com` brand view |
| Benchmark chat | nauthenticity `POST /api/v1/social-profiles/:id/chat` | nauthenticity dashboard |
| InspoBase Q&A | nauthenticity `POST /api/v1/brands/:id/inspo/chat` | nauthenticity dashboard |
| Cross-brand search | nauthenticity `POST /api/v1/workspaces/:id/search` | `app.9nau.com` universal search |

All use the same underlying `KnowledgeChunk` table with different `ownerType`/`sourceType` filters.

---

## 9. Execution plan

Not in the current foundational refactor. Scheduled after Phase 9.

1. Introduce `KnowledgeChunk` table alongside existing `Embedding`.
2. Backfill from `Transcript + Embedding`.
3. Build brand chatbot endpoint + UI as the first surface.
4. Progressively migrate benchmark and cross-brand surfaces.
5. Drop `Embedding` table once all consumers migrated.

---

## 10. Open questions

- **Multi-lingual**: chunks may be in different languages. Current `text-embedding-3-small` is multilingual. No action needed now, revisit if retrieval quality suffers.
- **User-uploaded docs**: platform allows PDF/MD upload per brand as context for chatbot. PDF→text→chunk pipeline not yet designed. Tracked as a follow-up.
- **Privacy**: chunks carry brand content. Tenancy enforced at the `ownerId` level. Cross-tenant leakage is prevented by always filtering on `ownerId` at query time — enforced via SDK (no raw DB access from app layer).

---

## 11. Related

- [../platform/ENTITIES.md](../platform/ENTITIES.md) — `Embedding` current state, `Brand`, `SocialProfile`
- [../services/nauthenticity.md](../services/nauthenticity.md) — host of pgvector
- [../features/brand-intelligence.md](../features/brand-intelligence.md) — current intelligence surfaces
- [ROADMAP.md](ROADMAP.md) — where this sits in the sequence (post-Phase-9)
