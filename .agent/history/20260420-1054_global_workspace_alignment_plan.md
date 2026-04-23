# Global Plan: Platform Workspaces & Brands Alignment

## 1. Domain & Goal
- **Domain:** Platform-wide Identity & Hierarchy (Workspaces, Brands, Users).
- **Goal:** Elevate `Workspace` and `Brand` to be universal, centralized abstractions entirely owned by **9naŭ** (the platform Identity Provider). Eliminate duplication and synchronization logic. Standardize naming and data structures across all services.

## 2. Architecture & Data Ownership (The Standard)

### The Source of Truth: 9naŭ (`9nau-api` / `9nau-postgres`)
9naŭ becomes the absolute owner of the corporate hierarchy:
- **`Workspace`**: Organization container.
- **`User`** & **`WorkspaceMember`**: Role-based access map.
- **`Brand`**: A high-level entity representing a brand under a Workspace. Holds structural metadata (Name, timezone, etc).

### The Consumers (flownaŭ, naŭthenticity, zazŭ)
- **Pattern:** Downstream services **DO NOT** clone the `Workspace`, `User`, or `Brand` structural models. 
- **Implementation:** Services use `workspaceId` and `brandId` string references on their core models.
- **UI & UX:** Consumer dashboards don't have "Create Workspace" or "Invite User" buttons. They delegate to `accounts.9nau.com`. They fetch workspace/brand listings via `9nau-api` or read them from JWT claims. Zazŭ's Dashboard will allow switching workspace context via the UI.

### Domain Separation Matrix
| Entity | 9naŭ (Core) | flownaŭ (Content) | naŭthenticity (Intel) |
|--------|-------------|-------------------|-----------------------|
| **Workspace** | Yes (`id`, `name`) | Reference (`workspaceId`) | Reference (`workspaceId`) |
| **Brand** | Yes (`id`, `name`, `workspaceId`) | Reference (`brandId`) | `BrandIntelligence` (DNA, limits, hooks by `brandId`) |
| **User** | Yes (all user data) | Reference (`platformUserId`) | Reference (`userId`) |

## 3. Execution Roadmap

This constitutes a multi-service migration. Development will execute sequentially to ensure the IDP is ready before consumers migrate.

- [ ] **Phase 1: 9naŭ Backend & Core Schemas (Target: `9nau-api`)**
  - Add `Brand` model to `9nau` Prisma schema (linked to `Workspace`).
  - Create platform API endpoints (`GET /api/organizations/my`, `GET /api/organizations/brands`).
  - Update SSO JWT token structure to embed the user's default/active `workspaceId` and `brandId`.

- [ ] **Phase 2: 9naŭ Centralized UI (Target: `9nau/apps/accounts` & `app`)**
  - Build UI for Workspace creation, renamed/update, and member invitation.
  - Build UI for Brand creation under a Workspace.
  
- [ ] **Phase 3: flownaŭ Deprecation & Refactor (Target: `flownaŭ`)**
  - Drop the local `Workspace` and `WorkspaceUser` Prisma models.
  - Refactor all strategy schemas finalized in Phase 18 (`BrandPersona`, `ContentPlanner`, `IdeasFramework`, `ContentCreationPrinciples`, `AccountTemplateConfig`) to link universally to `brandId` and `workspaceId` string fields instead of `accountId`.
  - Re-align `SocialAccount` to act as a child of the global `Brand`, rather than the top-level entity.
  - Cleanup flownaŭ frontend: replace local workspace navigation with cross-platform Context queries to 9naŭ.

- [ ] **Phase 4: naŭthenticity Domain Shift (Target: `nauthenticity`)**
  - Refactor `Brand` table into `BrandIntelligence` (since core Brand moves to 9naŭ).
  - Update scraping runs to rely on `brandId`.

- [ ] **Phase 5: Zazŭ Dashboard Context (Target: `zazŭ`)**
  - Integrate Workspace / Brand UI selection panel in Zazŭ dashboard.
  - Zazŭ telegram bot handles routing seamlessly using user context or prompting via inline buttons if actions are ambiguous across multiple brands.
