# Feature — Content Creation Pipeline

- **Owner:** flownaŭ
- **Entry points:** flownaŭ dashboard (manual/brainstorm), cron jobs (automatic), mobile capture (InspoBase ingestion)

---

## Stages

```
InspoBase digest / manual brief / automatic cron
        │
        ▼
  1. Ideation — generate Post ideas from Brand prompts + InspoBase
        │
        ▼
  2. Composition — select Template, compose creative (scenes, caption, hashtags)
        │
        ▼
  3. Rendering — Remotion render → MP4 → upload to R2
        │
        ▼
  4. Publishing — Instagram Graph API → mark Post published
```

Each stage is a separate BullMQ queue job. Stages are independent — failure in rendering does not block new ideation.

---

## The `Post` entity (single pipeline entity)

flownaŭ uses a single `Post` model that evolves through the full lifecycle via a status state machine:

```
IDEA_PENDING → IDEA_APPROVED → DRAFT_PENDING → DRAFT_APPROVED
→ SCHEDULED → RENDERING → RENDERED_PENDING → RENDERED_APPROVED → PUBLISHED
```

| Field group | Added when |
|---|---|
| `ideaText`, `source`, `priority`, `language` | Stage 1 — Ideation |
| `templateId`, `format`, `creative`, `payload`, `caption`, `hashtags` | Stage 2 — Composition |
| `scheduledAt` | Stage 3 — Scheduling |
| `videoUrl`, `coverUrl`, `externalPostId`, `publishedAt` | Stage 4 — Publishing |

Other entities owned by flownaŭ:

| Entity | Description |
|---|---|
| `Template` | Remotion scene definition: remotionId, sceneType, contentSchema, systemPrompt |
| `Asset` | R2 media reference (image, video, audio) with tags and usage tracking |
| `RenderJob` | BullMQ render task: status, progress, outputUrl, attempts |
| `BrandTemplateConfig` | Per-brand template enable/disable + auto-approve flags |
| `PostSchedule` | Format chain + daily frequency + time window per brand |
| `PostSlot` | Materialized calendar slot — filled by the scheduler |
| `ContentPlan` | Optional weekly editorial calendar (pieces + scripts) |

---

## Idea sources

| Source | `source` field value | How triggered |
|---|---|---|
| InspoBase digest (nauthenticity) | `automatic` | Daily cron, top inspo items per brand |
| Manual brief | `manual` | User enters idea text in dashboard |
| Capture from mobile | `capture` | 9naŭ mobile overlay sends to InspoBase |

---

## Prompt dependencies (local to flownaŭ)

| Config | Used in stage |
|---|---|
| `Brand.ideationPrompt` | Ideation — brand voice + ideation guidance |
| `Brand.composerPrompt` | Composition — how to fill template slots |
| `Template.systemPrompt` | Composition — per-template narrative guidance |
| `Template.contentSchema` | Composition — slot specs per scene |
| `BrandPersona.systemPrompt` | Ideation/composition — persona overlay |

> Note: Prompt centralization into 9naŭ API (`Prompt` table) is planned in Roadmap Phase 6.

---

## Cron jobs

| Route | Trigger | Action |
|---|---|---|
| `/api/cron/ideation` | Daily | Generate Post ideas per brand |
| `/api/cron/composition` | Daily +2h | Compose IDEA_APPROVED posts |
| `/api/cron/render` | Daily +4h | Render DRAFT_APPROVED posts |
| `/api/cron/publish` | Per-post schedule | Publish RENDERED_APPROVED posts to Instagram |

---

## Related

- [../services/flownau.md](../services/flownau.md)
- [../future/content-origins-expansion.md](../future/content-origins-expansion.md)
- [../future/social-platform-expansion.md](../future/social-platform-expansion.md)
- [../future/post-frequency-feature.md](../future/post-frequency-feature.md)
