# Phase 3: flownaŭ Domain Deprecation & Architecture Shift

## Objectives
Align flownaŭ to the new platform `Brand` hierarchy. Decouple its isolated `Workspace` DB implementation and migrate its AI strategy models to run at the `Brand` level rather than the physical `SocialAccount` transport level.

## Tasks

- [ ] **Schema Migration: Drop Local Tenancy (`flownau/prisma/schema.prisma`)**
  - Drop the local `Workspace` and `WorkspaceUser` models and their relations.
  - Replace relations with `workspaceId` (String) across the relevant data tree.

- [ ] **Schema Migration: Strategy Abstraction Shift**
  - Refactor strategy models: `BrandPersona`, `ContentPlanner`, `IdeasFramework`, `ContentCreationPrinciples`.
  - Remove the `accountId` column/relation from these models.
  - Attach `brandId` and `workspaceId` columns uniformly to these models! Strategy maps exactly to the Brand.

- [ ] **Schema Migration: Re-align `SocialAccount`**
  - Modify `SocialAccount` to act as a *child* of the `brandId`. 
  - Ensure `AccountTemplateConfig` remains on `SocialAccount` since formatting/publishing gates remain specific to the actual network profile.

- [ ] **Backend Restructuring (`flownau/src/modules/`)**
  - Rewrite DB access queries in `ideation`, `scheduling`, and `composer` to join against `brandId` instead of `accountId`.
  - Update `template-selector.ts` and `planner-strategist.ts` logic to operate holistically over a Brand's entire suite of linked SocialAccounts.

- [ ] **Frontend Overhaul (`flownau/src/app/`)**
  - Strip completely any UI components related to creating Workspaces, inviting members, or editing Brand names. Replace them with redirects to the `9naŭ Platform Settings`.
  - Implement a global "Brand Switcher" Context in the header that queries `9nau-api` via server components or parses context directly from the SSO JWT.

## Verification Criteria
- [ ] flownaŭ successfully boots with the new unified 9naŭ hierarchy schema.
- [ ] The autonomous engines (Ideation, Scheduling, Composer) successfully execute generation targets by reading rules from the `brandId` level.
- [ ] Rendered compositions correctly identify and ship to all child `SocialAccount`s designated by the publishing gates.
