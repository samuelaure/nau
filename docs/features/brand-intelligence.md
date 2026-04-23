# Feature — Brand Intelligence

- **Owner:** nauthenticity
- **Entry points:** nauthenticity dashboard, 9naŭ mobile, scheduled scraping

---

## Sub-features

### 1. Profile monitoring (benchmark)

Track competitor/inspiration profiles. naŭ user adds a `SocialProfile` with `role: BENCHMARK_TARGET`. Scraping runs periodically via Apify, posts are transcribed and embedded.

### 2. InspoBase

User-captured inspiration items (images, Reels, posts). Captured via mobile overlay or URL paste. Each item ingested: scrape → transcribe → embed → tag hooks/themes.

### 3. Benchmark chat (RAG)

"Talk to a profile's content." pgvector cosine search over `KnowledgeChunk` rows scoped to `(platform, platformId)`. LLM synthesizes answer from top-K chunks.

See [../future/rag-knowledge-base.md](../future/rag-knowledge-base.md) for the target KnowledgeChunk architecture.

### 4. Brand synthesis

Periodic AI digest extracting recurring patterns, themes, and voice signals from a brand's own content or a monitored profile. Stored as `BrandSynthesis`.

### 5. Comment suggestions

See dedicated feature doc: [comment-suggester.md](comment-suggester.md).

---

## Pipeline

```
SocialProfile (BENCHMARK_TARGET | INSPIRATION)
        │
        ▼
  Apify scraping run → Post rows (keyed by platform+platformId, deduped)
        │
        ▼
  Media download → R2 storage
        │
        ▼
  Transcription (whisper) → Transcript rows
        │
        ▼
  Embedding (OpenAI text-embedding-3-small) → KnowledgeChunk rows in pgvector
        │
        ▼
  Synthesis job (periodic) → BrandSynthesis
```

---

## Scrape deduplication

Multiple brands can monitor the same profile (e.g., two users both track `@nike`). `Post` rows are keyed by `(platform, platformId)`. Scraping deduplicates at the row level — embeddings are also shared. Brand-specific context is attached via `InspoItem` or `BrandSynthesis` references.

---

## Queues

| Queue | Purpose |
|---|---|
| `ingestion.queue` | New InspoItems, capture triage |
| `download.queue` | Apify jobs |
| `compute.queue` | Transcription + embedding |
| `optimization.queue` | Periodic re-ranking / re-embedding |

---

## Related

- [../services/nauthenticity.md](../services/nauthenticity.md)
- [../future/rag-knowledge-base.md](../future/rag-knowledge-base.md)
- [comment-suggester.md](comment-suggester.md)
