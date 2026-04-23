# Phase 1: 9naŭ Backend & Core schemas (Platform Workspaces)

## Objectives
Establish 9naŭ as the unquestionable source of truth for `Workspace` and `Brand` entities. Extend the `9nau-api` to serve this data centrally to all other services in the naŭ ecosystem.

## Tasks

- [ ] **Prisma Schema Updates (`9nau/apps/api/prisma/schema.prisma`)**
  - Ensure `Workspace` and `WorkspaceMember` cover required tenant mapping.
  - Add `Brand` model:
    - Fields: `id`, `workspaceId`, `name`, `timezone`, `isActive`, `createdAt`, `updatedAt`.
    - Relation to `Workspace`.

- [ ] **Platform API Extensions (`9nau-api`)**
  - `GET /api/workspaces` — Return workspaces the user is a member of.
  - `POST /api/workspaces` — For completeness (though UI comes in Phase 2).
  - `GET /api/workspaces/:workspaceId/brands` — Return all brands for a specific workspace.
  - `POST /api/workspaces/:workspaceId/brands` — Create a new brand for the platform.
  
- [ ] **Security & Authorization Middleware**
  - Protect all endpoints via the internal `x-nau-service-key` (for cross-service fetches) AND standard user JWTs (for UI dashboard).
  - Inject `activeWorkspaceId` into the user JWT claims when they log in to standardize context sharing across domain apps.

## Verification Criteria
- [ ] `Brand` instances can be successfully seeded into the `9nau` database attached to a valid `Workspace`.
- [ ] A curl / integration test with `NAU_SERVICE_KEY` successfully returns the workspaces and brands JSON payloads.
- [ ] `nauthenticity` and `flownau` can hypothetically replace their DB queries with `axios.get('http://api.9nau.com/...')` successfully.
