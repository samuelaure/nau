# Brand Context Migration — voicePrompt → BrandContext

> Next plan after `source-concepts-and-knowledge-bases.md`.
> Status: Stand-by. Implement after Priority 4 of the source-concepts plan is complete.

## What this plan does

Centralizes brand identity (voice, tone, personality) into the `BrandContext` entity — removing the split between `Brand.voicePrompt` and `BrandContext` that currently exists in nauthenticity.

## Current state

- `Brand.voicePrompt` — a plain text field on the Brand model. Used by:
  - Comment generation (fanout.processor, reactive.service)
  - Source concept generation (source-concept.service)
  - Owned synthesis generation (inspo.service — legacy, being removed)
  - Benchmark voice fallback (benchmark.service)

- `BrandContext` — a structured entity already introduced in nauthenticity, carrying richer brand identity data. Currently co-exists with voicePrompt.

## Goal

One source of truth for brand identity: `BrandContext`. The same context that gives voice and tone to flownaŭ content generation is the same used for comment generation in nauthenticity.

`Brand.voicePrompt` is deprecated and removed. All consumers are updated to read from `BrandContext`.

## Scope

### nauthenticity

1. **Migrate existing `voicePrompt` values** into `BrandContext` as a one-time data migration.
2. **Remove `Brand.voicePrompt`** field (destructive migration — requires tolerant code first).
3. **Remove `BrandSynthesis` model** and all synthesis methods:
   - `InspoService.generateOwnedSynthesis()`, `getLatestOwnedSynthesis()`, `getLatestOwnedVoice()`
   - `synthesis.service.ts` (Fastify module)
   - `BenchmarkService` voicePrompt fallback → replace with `BrandContext` lookup
   - All controller routes that expose synthesis endpoints
   - Schema: `DROP TABLE "BrandSynthesis"`
4. **Update comment generation** (fanout.processor, reactive.service) to use `BrandContext`.
5. **Update source concept generation** (source-concept.service) to use `BrandContext` instead of `voicePrompt`.

### flownau

6. **Audit `brand.context`** — confirm it is the same concept as nauthenticity `BrandContext` and that the sync between them is correct.
7. **Remove any references to `voicePrompt`** passed from flownau to nauthenticity.

## Migration sequence (destructive-safe)

1. Deploy tolerant code: all consumers read `BrandContext` if present, fall back to `voicePrompt` if not.
2. Run data migration: copy existing `voicePrompt` values into `BrandContext`.
3. Deploy cleanup: remove `voicePrompt` fallback paths.
4. Run schema migration: `ALTER TABLE "Brand" DROP COLUMN "voicePrompt"`.
5. Drop `BrandSynthesis` table.

## Status

Stand-by. Tackle after the source-concepts-and-knowledge-bases plan (Priority 4) is complete.
