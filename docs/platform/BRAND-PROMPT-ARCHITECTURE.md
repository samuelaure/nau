# Brand Prompt Architecture & Tuning Protocol

Reference for every brand prompt-tuning session. Covers how the prompt system works, what each layer contributes, and the exact protocol to replicate for any brand.

---

## How the Final Prompt Is Assembled

Every ideation or draft LLM call is a single system prompt built by `kernel.ts:buildPrompt()` from ordered layers, each wrapped in an XML tag. The LLM is told that later sections narrow and override earlier ones.

```
<base>              Universal quality rules, formatting, psychological principles.
                    DRAFT_BASE or IDEATION_BASE. Never repeat what's here.

<brand_context>     Rendered by renderBrandContextBlock():
                    "BRAND CONTEXT:\n[brand.name]\n[customAdditions + content]"
                    customAdditions are prepended before the LLM-generated content.
                    Never repeat what's here in lower layers.

<custom_prompt>     Brand-level standing instructions (ideation OR draft).
                    Only adds what base + brand_context don't cover.

<template_schema>   Auto-built from slotSchema or contentSchema + slot overrides.
                    Lists every slot with its intention and word limits.
                    Never repeat slot definitions in template_custom_prompt.

<template_custom_prompt>  Template-specific purpose and narrative rules.
                          Overrides custom_prompt for this template's scope.
                          Only adds what schema + custom_prompt don't cover.

<selected_idea>     The idea being developed (drafts only, injected automatically).
```

**User message** is built separately:
- Ideation: `"Generate N ideas about: [topic]"` + recent content to avoid
- Draft: `"Create content for this idea: [ideaText]"` + recompose context if applicable

### Slot Templates vs Head Talk Templates

- **Slot-based** (`slotSchema`): schema renders as a slot list (`• key — intention (word range)`). Slot overrides replace individual slot fields (intention, minWords, maxWords).
- **Head Talk** (`contentSchema`): schema renders as raw JSON. Slot overrides modify `sections[]` by key. The LLM outputs `{ hook, body, cta, caption, hashtags }`.

---

## The 7 Customization Layers

| Layer | What | Model/Field | Scope |
|---|---|---|---|
| 0 | Base rules (hardcoded) | `kernel.ts` | All brands, all templates |
| 1a | LLM-generated brand context | `BrandContext.content` (nauthenticity) → `Brand.context` (flownau) | Per brand |
| 1b | Custom Additions | `BrandContext.customAdditions` (nauthenticity) | Per brand — survives regeneration |
| 2 | Ideation Custom Prompt | `Brand.ideationCustomPrompt` (flownau) | Per brand, ideation only |
| 3 | Draft Custom Prompt | `Brand.draftCustomPrompt` (flownau) | Per brand, drafting only |
| 5 | Template Structure | `Template.slotSchema` / `contentSchema` (flownau) | Per template, all brands |
| 6 | Brand-Template Custom Prompt | `BrandTemplateConfig.customPrompt` (flownau) | Per brand × per template |
| 7 | Slot Overrides | `BrandTemplateConfig.slotOverrides` (flownau) | Per brand × per template × per slot |

### Precedence rules

1. Later layers narrow earlier ones — they don't replace them globally.
2. Layer 6 overrides Layer 3 within its template scope.
3. Slot overrides replace the template's default slot fields for that key only.
4. Custom Additions prepend to brand context content — they don't replace it.
5. Source concepts (Layer 4) go into the **user message**, not the system prompt.

### What Layer 0 already covers (never repeat in any prompt)

- Quality criteria: resonance, specificity, novelty, curiosity gap
- Psychological mechanisms: identity alignment, schema disruption
- Formatting: blank lines between paragraphs, 1–3 sentences max per paragraph, no walls of text
- Draft: tension-resolution structure, concrete language, ELM model

---

## Brand Prompt Session Protocol

### Step 0 — Read the brand from the database before asking anything

Run these queries to understand the current state. Use the DB credentials from the containers.

```bash
# Find the brand ID in flownau
docker run --rm --network nau-network postgres:16 psql \
  'postgresql://flownau:<pass>@flownau-postgres:5432/flownau' -t \
  -c "SELECT id, name FROM \"Brand\" WHERE name ILIKE '%<brand>%';"

# Read brand context + custom additions (nauthenticity)
docker run --rm --network nau-network postgres:16 psql \
  'postgresql://nauthenticity:<pass>@nauthenticity-postgres:5432/nauthenticity' -t \
  -c "SELECT content, \"customAdditions\" FROM \"BrandContext\" WHERE \"brandId\" = '<brandId>';"

# Read ideation + draft custom prompts (flownau)
docker run --rm --network nau-network postgres:16 psql \
  'postgresql://flownau:<pass>@flownau-postgres:5432/flownau' -t \
  -c "SELECT \"ideationCustomPrompt\", \"draftCustomPrompt\" FROM \"Brand\" WHERE id = '<brandId>';"

# Read all template configs (flownau)
docker run --rm --network nau-network postgres:16 psql \
  'postgresql://flownau:<pass>@flownau-postgres:5432/flownau' \
  -c "SELECT t.name, bt.\"customPrompt\", bt.\"slotOverrides\"
      FROM \"BrandTemplateConfig\" bt
      JOIN \"Template\" t ON t.id = bt.\"templateId\"
      WHERE bt.\"brandId\" = '<brandId>'
      ORDER BY t.name;"
```

With this data in hand, ask only the questions that can't be answered from the DB.

---

### Step 1 — Clarify brand intent

From the DB read, identify what's already defined and what's missing. Ask only about gaps:

- Core creative strategy and content mission
- Service or product being promoted
- Tone and voice beyond what brand context captures
- Audience segments (e.g. tormenta vs expansión)
- Language and register (tú/usted, language)
- CTA philosophy (conversion, community, or mix)
- What the brand explicitly avoids

Once clarified, confirm the **template objectives map** before writing any prompts:

| Template | Objetivo | Mode |
|---|---|---|
| Reel — Single Moment | 👁 Visibilidad | ... |
| Reel — Single Statement | 👥 Seguidoras | ... |
| Reel — Hook & Reveal | 💰 Conversiones | ... |
| Reel — Arc | 💬 Conversaciones | ... |
| Head Talk — Does This Happen to You | ❤️ Interacción | ... |
| Head Talk — Niche Tea | 👁 Visibilidad | ... |
| Head Talk — Contrarian Take | 👥 Seguidoras | ... |
| Head Talk — Before & After | 💰 Conversiones | ... |

---

### Step 2 — Propose all prompts for approval

Present a full proposal before touching the database. Structure it as:

1. **Estrategia global** — one paragraph: what the brand's content mechanism is, how the 8 templates cover the growth cycle.
2. **Mapa de plantillas** — table: template, objetivo, narrative mode.
3. **Layer 1b — Custom Additions** — what belongs here: founder identity, language register, tool-as-map rule, audience dual profile, narrative mode, CTA philosophy, service name. Never include things already in the auto-generated brand context.
4. **Layer 2 — Ideation Custom Prompt** — only adds: the valid-idea formula specific to this brand, quality gate, audience alternation, preferred narrative mode. Never repeat base resonance theory or brand context.
5. **Layer 3 — Draft Custom Prompt** — only adds: voice register (tú/usted, warmth level), tool-as-lens rule with brief-explanation requirement, conversion-by-experience rule, CTA variety. Never repeat base formatting rules or brand context.
6. **Layers 6 + 7 per template** — for each template:
   - **Custom Prompt (Layer 6):** the template's specific job for this brand + narrative arc. Does NOT repeat brand-level rules.
   - **Slot Overrides (Layer 7):** intention for each slot, min/max words if different from defaults. Each intention is brand-specific, not generic.

#### Non-redundancy checklist before submitting proposal

- [ ] No content from Layer 0 (base rules) repeated in any lower layer
- [ ] No content from brand_context repeated in custom_prompt or template prompts
- [ ] No slot definitions repeated in template_custom_prompt (only purpose/arc)
- [ ] Each layer adds only what layers above it don't already cover

---

### Step 3 — Apply to database

Once approved, apply in this order:

**1. Custom Additions — nauthenticity**

Check if `BrandContext` row exists first:
```sql
SELECT id FROM "BrandContext" WHERE "brandId" = '<brandId>';
```

If exists → `UPDATE`:
```sql
UPDATE "BrandContext"
SET "customAdditions" = $ca$...$ca$
WHERE "brandId" = '<brandId>';
```

If not → `INSERT`:
```sql
INSERT INTO "BrandContext" (id, "brandId", status, content, "customAdditions", "updatedAt")
VALUES ('<id>', '<brandId>', 'idle', '', $ca$...$ca$, NOW());
```

**2. Ideation + Draft Custom Prompts — flownau**

```sql
UPDATE "Brand"
SET "ideationCustomPrompt" = $ip$...$ip$,
    "draftCustomPrompt" = $dp$...$dp$
WHERE id = '<brandId>';
```

**3. Template Configs — flownau (one UPDATE per template)**

```sql
UPDATE "BrandTemplateConfig"
SET "customPrompt" = $cp$...$cp$,
    "slotOverrides" = $so${...}$so$::jsonb
WHERE "brandId" = '<brandId>' AND "templateId" = '<templateId>';
```

Use PostgreSQL dollar-quoting (`$tag$...$tag$`) to avoid escaping issues with single quotes in prompt text.

**4. Sync brand context to flownau**

After applying, sync so custom additions become active in flownau's prompt assembly. Either:
- UI: flownau → Brand Settings → "Sync from nauthenticity"
- Or trigger via API/service call

---

### Step 4 — Verify

```sql
-- Verify brand-level prompts
SELECT LEFT("ideationCustomPrompt", 80), LEFT("draftCustomPrompt", 80)
FROM "Brand" WHERE id = '<brandId>';

-- Verify all 8 template configs
SELECT t.name, LEFT(bt."customPrompt", 60), bt."slotOverrides" IS NOT NULL
FROM "BrandTemplateConfig" bt
JOIN "Template" t ON t.id = bt."templateId"
WHERE bt."brandId" = '<brandId>'
ORDER BY t.name;

-- Verify custom additions
SELECT LEFT("customAdditions", 100)
FROM "BrandContext" WHERE "brandId" = '<brandId>';
```

---

## Cloning Prompts to a Twin Brand

When a brand is a domain variant of another (same creator, same audience, same templates — different tool):

1. Read the source brand's current prompts from the DB (Step 0 above) — never use memory.
2. Identify the substitution map: e.g. `Diseño Humano → Astrología`, `mecanismo HD → elemento astrológico`, `tipos/autoridades/centros → planetas/signos/casas/aspectos/tránsitos`, `Interpretaciones → Lecturas de Carta Natal`.
3. Apply substitutions systematically across all layers.
4. Present for approval before applying.
5. Apply following Step 3.

---

## Prompt History

| Layer | History tracked? |
|---|---|
| Custom Additions | No — overwritten in place |
| Ideation Custom Prompt | Yes — `PromptHistory` table in flownau |
| Draft Custom Prompt | Yes — `PromptHistory` table in flownau |
| BrandTemplateConfig.customPrompt | Yes — via `account-templates` route |
| BrandTemplateConfig.slotOverrides | Yes — via `account-templates` route |

---

## Key Code Locations

| Component | File |
|---|---|
| Prompt kernel (assembly) | `apps/flownau/src/modules/prompts/kernel.ts` |
| Brand context rendering | `apps/flownau/src/modules/prompts/brand-context.ts` |
| Ideation service | `apps/flownau/src/modules/ideation/ideation.service.ts` |
| Source concept fetching | `apps/flownau/src/modules/ideation/sources/inspo-source.ts` |
| Draft pipeline | `apps/flownau/src/modules/composer/draft-pipeline.ts` |
| Slot override merging | `apps/flownau/src/modules/composer/draft-pipeline.ts` ~L291–323 |
| Prompt history tracking | `apps/flownau/src/modules/shared/prompt-history.ts` |
| Brand context generation | `apps/nauthenticity/src/nest/brand-context/brand-context.service.ts` |
| Source concept generation | `apps/nauthenticity/src/nest/inspo/source-concept.service.ts` |
| flownau DB | `apps/flownau/prisma/schema.prisma` |
| nauthenticity DB | `apps/nauthenticity/prisma/schema.prisma` |
