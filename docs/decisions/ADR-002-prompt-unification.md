# ADR-002 — Unify all prompts in a single `Prompt` table

- **Status:** 🟢 Accepted
- **Date:** 2026-04-23

## Context

Flournaŭ's schema grew multiple prompt-like tables over time:

- `BrandPersona { systemPrompt, modelSelection, ... }`
- `IdeasFramework { systemPrompt, ... }`
- `ContentCreationPrinciples { systemPrompt, ... }`
- `ContentPlanner { strategistPrompt }`
- `SocialAccount { directorPrompt, creationPrompt }`
- `Template { systemPrompt, creationPrompt, captionPrompt }`

Each is just a named piece of text with optional model selection, ownership, and metadata. The schema has six ways to represent "a prompt."

Nauthenticity had `BrandIntelligence.voicePrompt` and `BrandIntelligence.commentStrategy` — two more.

This proliferation creates:
- Repeated CRUD surfaces for nearly identical concepts
- Awkward UI (separate screens to manage nearly-identical rows)
- Difficulty evolving (e.g., adding "modelSelection" requires adding the column to every table)
- No way to list "all prompts for this brand" without UNION-ing several tables

## Decision

**One `Prompt` table. Any prompt, anywhere in the platform, is a row in this table.**

```prisma
model Prompt {
  id              String           @id @default(cuid())
  ownerType       PromptOwnerType   // PLATFORM | WORKSPACE | BRAND | SOCIAL_PROFILE | TEMPLATE
  ownerId         String            // polymorphic
  type            PromptType        // VOICE | COMMENT_STRATEGY | CONTENT_PERSONA | ...
  name            String
  content         String   @db.Text
  modelSelection  AIModel?
  isDefault       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([ownerType, ownerId, type])
}
```

Full type + enum specification in [../platform/ENTITIES.md §2](../platform/ENTITIES.md#prompt).

The table lives in 9naŭ API (centralized alongside other identity entities per [ADR-001](ADR-001-entity-centralization.md)).

### Graceful defaulting

Services call `/prompts/resolve?ownerType=X&ownerId=Y&type=Z`. The 9naŭ API walks the ownership hierarchy and returns the most specific match:

```
BRAND + brandId + VOICE
   ↓ if not found
WORKSPACE + workspaceId + VOICE
   ↓ if not found
PLATFORM + "platform" + VOICE (master default)
```

This preserves the "Name-Only Brand Creation" onboarding pattern (brand-new brands inherit platform defaults until the user overrides).

## Alternatives considered

### A. Keep per-feature tables

Rejected for the reasons listed in Context.

### B. JSON blob on each owning entity (`Brand.prompts: Json`)

E.g., `Brand.prompts = { voice: "...", commentStrategy: "...", persona: "..." }`.

Rejected because:
- No typing discipline — schema evolution becomes a free-for-all
- Can't index or query by type across brands
- Can't have multiple prompts of the same type (variants for A/B testing)
- Harder to version individually

### C. Separate "BrandPrompts" + "TemplatePrompts" tables

Better than status quo, but still splits by owner. Rejected in favor of fully unified.

## Consequences

### Positive

- **One UI surface** manages all prompts. One API shape. One resolution function.
- **Easy to add a new prompt type** — it's one enum value, not a new table + migration + UI.
- **Variants are first-class**: a brand can have multiple `type=VOICE` prompts and mark one default, supporting experimentation.
- **Defaulting is free**: the resolution function handles fallback to workspace / platform defaults.
- **Observability**: all prompt usage is visible in one place.

### Negative

- **Polymorphic FK (`ownerType` + `ownerId`)** — referential integrity not enforced by Postgres directly. Mitigated by application-level checks via `@nau/sdk`.
- **Slightly more verbose queries** (filter by `ownerType` AND `ownerId` AND `type`).

### Migration

Existing data (if any) from legacy tables is backfilled into `Prompt` during Phase 2 of the [roadmap](../future/ROADMAP.md). With no production data (pre-launch), the migration is trivial.

## References

- [../platform/ENTITIES.md §2 Prompt](../platform/ENTITIES.md#prompt)
- [ADR-001](ADR-001-entity-centralization.md) (parent pattern — prompts live in 9naŭ API for the same reason)
