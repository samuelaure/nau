# Triage — Brand Routing Fix

> Status: broken. Does not affect core nauthenticity or flownau features. Fix when triage becomes active.

## What is broken

`TriageService.processRawText` in `apps/api/src/triage/triage.service.ts` calls two no-op stubs:

```typescript
// Both return [] and null — brand data is no longer in nauthenticity
await this.nauthenticityService.getBrandsForWorkspace(workspaceId) // returns []
await this.nauthenticityService.getBrandDnaLight(brandId)          // returns null
```

Brand data moved to the `api` service (owned by `BrandsService`). The nauthenticity stubs were never updated.

**Impact:** the `content_idea` category in triage never gets brand context. The LLM sees
`"No brands registered."` and can't route ideas to brands. All content_ideas are saved with
`brandId: null` and `flownauSyncStatus: 'no_account'` — never forwarded to flownau.

All other triage categories (action, project, habit, appointment, someday_maybe, reference)
work correctly and are unaffected.

## The fix

### 1. Replace `getBrandsForWorkspace` with a direct `BrandsService` call

`TriageService` already injects `PrismaService`. Add `BrandsService` injection and call it directly — brand data is in the same `api` Postgres DB.

```typescript
// Replace:
brandsForPrompt = await this.nauthenticityService.getBrandsForWorkspace(workspaceId);

// With:
const brands = await this.brandsService.findByWorkspace(workspaceId);
brandsForPrompt = brands.map(b => ({
  id: b.id,
  brandName: b.name,
  voicePrompt: b.commentPrompt ?? '',   // commentPrompt is the current replacement
}));
```

### 2. Replace `getBrandDnaLight` with `BrandsService` + nauthenticity `dna-light`

```typescript
// Replace:
const dna = await this.nauthenticityService.getBrandDnaLight(brandId);

// With:
const brand = await this.brandsService.findOne(brandId);
const dnaLight = await this.nauthenticityService.getDnaLight(brandId); // GET /_service/brands/:id/dna-light
brandsForPrompt = brand ? [{
  id: brand.id,
  brandName: brand.name,
  voicePrompt: dnaLight?.commentPrompt ?? brand.commentPrompt ?? '',
}] : [];
```

### 3. Clean up stale TypeScript types

Remove `voicePrompt` from the return type signatures in `NauthenticityService` stubs
(`getBrandsForWorkspace`, `getBrandDnaLight`) — rename to `commentPrompt` or remove the stubs
entirely once the callers are updated.

## Files to change

- `apps/api/src/triage/triage.service.ts` — replace both nauthenticity stub calls
- `apps/api/src/triage/triage.module.ts` — add `BrandsModule` to imports
- `apps/api/src/integrations/nauthenticity.service.ts` — remove or fix the two stubs

## No schema or migration needed — purely a service-layer fix.
