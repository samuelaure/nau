# Future — Content Origins Expansion

> Adding new **origins** (sources) from which `ContentIdea`s can flow into flownaŭ's pipeline.

**Status:** scoped, not yet built. Out of the current foundational refactor.

---

## Context

Today flownaŭ's `ContentIdea` has three origin flows:

1. **Captured** — user captures an Instagram post via 9naŭ mobile; triaged into InspoBase; flownaŭ reads it.
2. **Manual** — user types an idea directly in flownaŭ UI.
3. **Automatic** — cron generates ideas from Brand DNA + InspoBase digest.

The platform's trajectory calls for more origins — specifically **YouTube** (long-form video → short clip ideas) and **blog articles** (URL → extracted themes → content ideas).

## Target

Add two new origin handlers to the ideation engine, each producing standard `ContentIdea` rows with `source` set to the origin:

- `ContentIdea.source = 'youtube'` — generated from YouTube video transcript + metadata.
- `ContentIdea.source = 'article'` — generated from a URL-fetched blog article.

Both share the same pattern:

1. User submits a URL (from mobile overlay, web UI, or zazu command).
2. Fetch content (yt-dlp for YouTube; article extractor like Mercury / Readability for HTML).
3. Transcribe (YouTube) or parse (HTML).
4. Chunk + embed into `KnowledgeChunk` (see [rag-knowledge-base.md](rag-knowledge-base.md)).
5. Run ideation prompt over the source with Brand DNA as context.
6. Persist `ContentIdea` rows.

## Data model changes

No new entities required. `ContentIdea.source` enum extends:

```prisma
enum ContentIdeaSource {
  CAPTURED
  MANUAL
  AUTOMATIC
  YOUTUBE       // NEW
  ARTICLE       // NEW
}
```

`ContentIdea.sourceRef` (already exists) stores the original URL.

## API surface

New flownaŭ endpoint:

```
POST /api/v1/brands/:id/content/ideas/from-url
  body: { url, sourceType: 'youtube' | 'article' }
  auth: USER + member
```

Server action wrapper for direct UI use.

## Prompt additions

Add platform-default prompts:

- `Prompt { ownerType: PLATFORM, type: SYSTEM, name: 'youtube-ideation', content: '...' }`
- `Prompt { ownerType: PLATFORM, type: SYSTEM, name: 'article-ideation', content: '...' }`

Brands can override by creating `ownerType: BRAND, type: SYSTEM` rows with matching names (or a type extension later if this grows).

## Execution

Post-Phase 9. Add when the first user asks for it.

## Related

- [../platform/ENTITIES.md](../platform/ENTITIES.md) — `ContentIdea` schema
- [../features/content-creation-pipeline.md](../features/content-creation-pipeline.md) — current pipeline
- [rag-knowledge-base.md](rag-knowledge-base.md) — how content gets embedded
