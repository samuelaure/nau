# Phase 4: naŭthenticity Intelligence Realignment

## Objectives
Refine naŭthenticity to operate exclusively as the "Brand Intelligence Add-on" for the core 9naŭ `Brand` entity by severing its structural duplication of the Brand table.

## Tasks

- [ ] **Database Refactor (`nauthenticity/src/db/schema.prisma`)**
  - Deprecate structural/metadata columns from the local `Brand` table (`workspaceId`, `brandName`, `timezone`, `isActive`, etc.) since those now live strictly in `9nau-api`.
  - Maintain the local table, but treat it as `BrandIntelligence` (Primary Key = `brandId` mapped to 9nau).
  - Retain strictly domain-specific fields: `voicePrompt`, `commentStrategy`, `suggestionsCount`.

- [ ] **API Cleanup**
  - Remove all REST endpoints responsible for natively creating or structurally altering a Brand.
  - Persist only endpoints that interact with Intelligence updates (e.g., `PUT /api/brands/:brandId/dna`) or fetching intelligence for upstream services.
  - Update Scraping runs and Apify worker queues to correctly bind the parsed Instagram data to the incoming `brandId`.

- [ ] **Auth Middleware Guarding**
  - Verify that upstream consumers (`flownau`, `zazu`) querying for Brand Intelligence provide valid `NAU_SERVICE_KEY` headers, ensuring secure fetching.

## Verification Criteria
- [ ] `nauthenticity` database relies solely on `brandId` without duplicating fundamental workspace routing metadata.
- [ ] Integrations correctly proxy full metadata from `9nau-api` + DNA from `nauthenticity`.
