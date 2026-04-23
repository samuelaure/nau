# Phase 2: Platform Settings & UI Expansion (9naŭ)

## Objectives
Build the unified UI in the **9naŭ Platform** (the central Control Plane) to allow users to fully manage their Workspaces, the Members within those Workspaces, and the Brands owned by those Workspaces.

## Tasks

- [ ] **API Integrations (`9nau/apps/app`)**
  - Implement React Query hooks (or equivalent) to integrate with the new `9nau-api` endpoints from Phase 1.
  - Endpoints to consume: `GET /api/workspaces`, `POST /api/workspaces`, `GET /api/workspaces/:id/members`, `PUT /api/workspaces/:id/members`, `GET /api/workspaces/:id/brands`, `POST /api/workspaces/:id/brands`.

- [ ] **Workspace Settings Dashboard**
  - Create a new settings section: "Platform Workspaces".
  - Build UI to create a new Workspace and rename existing ones.
  - Build Member management UI: send invitations (via email/link) to join the Workspace, manage roles (owner/user/viewer).

- [ ] **Brand Management UI**
  - Within a selected Workspace, provide a UI to "Create Brand".
  - Form fields: `Brand Name`, `Timezone`.
  - Display the list of registered Brands for the currently active Workspace.

- [ ] **Auth Navigation Context**
  - Upon successful login into any naŭ Platform system, ensure the `9nau-api` injects the user's last active `workspaceId` into their JWT token/cookie to guarantee smooth contextual redirection when launching other apps like flownaŭ.

## Verification Criteria
- [ ] A user can create a Workspace, invite a member, switch to it, and create multiple Brands underneath it directly from the globally centralized `9nau` web app.
- [ ] No local database inserts happen; everything flows securely through `9nau-api`.
