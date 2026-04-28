# Plan: Remove directorPrompt & creationPrompt from Brand model

## Context

`Brand.directorPrompt` and `Brand.creationPrompt` were originally intended as brand-level AI
instruction overrides. They are currently stored in the DB but **never read** by any pipeline
(composer, coverage, ideation, or renderer). They were removed from the UI in April 2026.

---

## What needs to change

### 1. Prisma schema — `apps/flownau/prisma/schema.prisma`

Remove the two fields from the `Brand` model:

```diff
- directorPrompt  String?
- creationPrompt  String?
```

### 2. Migration

```bash
cd apps/flownau
npx prisma migrate dev --name remove_brand_prompts
```

This drops the two columns from the `Brand` table. No data loss risk — they have been
unpopulated / unused since the UI removal.

### 3. TypeScript — verify no remaining references

After schema change, run `npx prisma generate` and fix any type errors. Expected to be zero
since the UI already removed all reads/writes, but verify with:

```bash
grep -r "directorPrompt\|creationPrompt" apps/flownau/src
```

Only the `video/` module uses `creationPrompt` — but that is on the **Template** model,
not Brand. Confirm it compiles cleanly.

---

## Risk

Low. The columns are nullable, unused, and have no FK constraints.

## When to do this

Any time — no coordination needed. Suggested: bundle with the next scheduled DB migration.
