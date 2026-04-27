# Content Piece Pipeline — Unified Evolving Entity

## Status: Planned

---

## Problem

The current pipeline manages content as a chain of separate linked models:

```
ContentIdea → Composition → (scheduling) → (published)
```

This creates friction:
- Querying a piece's full state requires multiple joins
- Historical data is split across tables
- Status transitions are implicit in relationships, not in a single field
- The calendar feature (future) has no natural home for format slots

---

## Proposal

Replace `ContentIdea` + `Composition` with a single `ContentPiece` entity that accumulates data as it progresses through the pipeline.

### Pipeline stages and data growth

| Stage | Status | New fields added |
|---|---|---|
| Idea | `IDEA` | `ideaText`, `language`, `topicRef`, `source`, `format` |
| Draft | `DRAFT` | `script`, `caption`, `hashtags` |
| Scheduled | `SCHEDULED` | `scheduledAt` |
| Composed | `COMPOSED` | `compositionData` (JSON), `templateId` |
| Published | `PUBLISHED` | `publishedAt`, `publishedUrl`, `externalId` |

### Proposed schema

```prisma
model ContentPiece {
  id          String   @id @default(cuid())
  brandId     String
  status      String   @default("IDEA")   // IDEA | DRAFT | SCHEDULED | COMPOSED | PUBLISHED
  source      String   @default("manual") // manual | capture | automatic
  priority    Int      @default(3)

  // Stage 1 — Idea
  ideaText    String   @db.Text
  language    String?
  format      String?                      // reel | carousel | head_talk | story | static_post | trial_reel
  topicRef    String?                      // digest URL, InspoItem ID, or free text label

  // Stage 2 — Draft
  script      String?  @db.Text
  caption     String?  @db.Text
  hashtags    String[]

  // Stage 3 — Scheduling
  scheduledAt DateTime?

  // Stage 4 — Composition
  templateId        String?
  compositionData   Json?                  // scenes array with all scene fields

  // Stage 5 — Published
  publishedAt   DateTime?
  publishedUrl  String?
  externalId    String?

  // Audit
  sourceRef   String?                      // lineage: digest URLs, InspoItem IDs
  aiLinked    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  brand    Brand          @relation(fields: [brandId], references: [id], onDelete: Cascade)
  template AiTemplate?    @relation(fields: [templateId], references: [id])
  scenes   Scene[]                         // optional child table if scene relations needed
}
```

### On scenes: JSON blob vs child table

`compositionData Json?` stores the full scene array for fast reads and simple queries. A `Scene[]` relation is kept as an optional child table only if per-scene asset linking or indexing becomes necessary. Default: JSON blob.

---

## Migration strategy

1. Run both models in parallel during transition: new pieces use `ContentPiece`, old ones stay in `ContentIdea` / `Composition`
2. Write a one-off migration script that maps existing records:
   - `ContentIdea` → `ContentPiece` at `IDEA` status
   - `ContentIdea` with linked `Composition` → `ContentPiece` at `COMPOSED` status, `compositionData` from serialised scenes
3. Once UI is updated to read from `ContentPiece`, drop old tables

---

## Affected files

- `apps/flownau/prisma/schema.prisma` — new model, deprecate ContentIdea + Composition
- `apps/flownau/src/modules/ideation/` — all origin callers write to ContentPiece
- `apps/flownau/src/modules/composer/` — reads/writes ContentPiece.compositionData
- `apps/flownau/src/modules/scheduling/` — sets ContentPiece.scheduledAt
- `apps/flownau/src/app/api/` — all endpoints referencing ContentIdea or Composition
- Frontend — ideas backlog, composition view, calendar

---

## Dependencies

- Must be complete before the Calendar Goals feature (see `calendar-posting-goals.md`)
- Ideation simplification (current sprint) writes to `ContentIdea` — compatible; field mapping is 1:1

---

## Priority: High — do before Calendar Goals
