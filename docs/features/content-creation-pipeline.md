# Feature — Content Creation Pipeline

- **Owner:** flownaŭ
- **Entry points:** flownaŭ dashboard, cron jobs, 9naŭ mobile (InspoBase ingestion)

---

## Stages

```
InspoBase / manual brief
        │
        ▼
  1. Ideation — generate ContentIdeas from Brand prompts + InspoBase digest
        │
        ▼
  2. Composition — select Template, build Composition (captions, hooks, assets)
        │
        ▼
  3. Rendering — Remotion render → MP4/image → upload to R2
        │
        ▼
  4. Publishing — Instagram Graph API → mark ContentIdea published
```

Each stage is a separate BullMQ queue job. Stages are independent cron invocations — failure in rendering does not block new ideation.

---

## Entities (owned by flownaŭ)

| Entity | Description |
|---|---|
| `ContentIdea` | One creative idea: title, brief, status (PENDING → APPROVED → COMPOSED → RENDERED → PUBLISHED) |
| `Composition` | Assembled content unit: slots filled with asset references, caption draft |
| `Template` | Remotion scene definition: layout, slot schema |
| `Asset` | R2 media reference (image, video, audio) |
| `RenderJob` | Remotion render task with status + output path |
| `ContentPlan` | Optional: weekly editorial calendar grouping ideas |

---

## Prompt dependencies (from 9naŭ API)

| Prompt type | Used in stage |
|---|---|
| `VOICE` | Ideation — Brand tone and voice |
| `IDEAS_FRAMEWORK` | Ideation — ideation structure rules |
| `CONTENT_PERSONA` | Ideation — target audience persona |
| `COMPOSITOR` | Composition — how to fill template slots |
| `CAPTION` | Composition — caption generation rules |

All fetched via `@nau/sdk.prompts.list({ brandId, types: [...] })`.

---

## Content origins

- **InspoBase digest** — top items from nauthenticity per brand
- **Manual brief** — user input in flownaŭ dashboard
- **Benchmark synthesis** — periodic AI theme digest from nauthenticity

Future origins: YouTube, blog articles — see [../future/content-origins-expansion.md](../future/content-origins-expansion.md).

---

## Cron jobs

| Cron | Trigger | Action |
|---|---|---|
| `/api/cron/ideation` | Daily | Generate ContentIdeas per brand |
| `/api/cron/composition` | Daily +2h | Compose approved ideas |
| `/api/cron/render` | Daily +4h | Render composed ideas |
| `/api/cron/publish` | Scheduled per-idea | Publish to Instagram |

---

## Related

- [../services/flownau.md](../services/flownau.md)
- [../future/content-origins-expansion.md](../future/content-origins-expansion.md)
- [../future/social-platform-expansion.md](../future/social-platform-expansion.md)
