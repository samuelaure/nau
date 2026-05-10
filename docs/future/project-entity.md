# Project Entity

> GTD "Project" container. Captures inside a Project are GTD "References" — profiles and posts
> collected as reference/foundation material. Same nauthenticity machinery as Brand categories,
> but scoped to a Project instead of a Brand.

## Design decisions

- **Path B** — `app.9nau.com` builds its own Project UI calling nauthenticity API directly.
  nauthenticity dashboard gets a workspace view showing Brands + Projects in sections (admin/operator view).
- **Brand-optional** — A Project always belongs to a Workspace; Brand link is optional.
- **No published content** — Projects are pure reference/knowledge base. Not displayed in flownau.
- **No analytics/insights UI** — but same underlying machinery is kept (CategoryMembership, SourceConcept, BrandContext-equivalent) so features work if needed later.
- **`Project` in nauthenticity** — not `ProjectIntelligence`. Mirrors api's Project, same pattern as `Brand`.
- **CategoryMembership extended** — `brandId` becomes nullable; `projectId` added (nullable). Check constraint: exactly one must be set.

## Schema

### `api` DB

```sql
CREATE TABLE "Project" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  workspaceId TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  brandId     TEXT REFERENCES "Brand"(id) ON DELETE SET NULL,  -- optional
  name        TEXT NOT NULL,
  description TEXT,
  isActive    BOOLEAN NOT NULL DEFAULT true,
  createdAt   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updatedAt   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### nauthenticity DB

```sql
-- Mirror of api's Project (same pattern as Brand)
CREATE TABLE "Project" (
  id          TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL,
  brandId     TEXT,              -- optional, denormalised from api
  name        TEXT NOT NULL,
  isActive    BOOLEAN NOT NULL DEFAULT true,
  createdAt   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updatedAt   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extend CategoryMembership to support Project ownership
ALTER TABLE "CategoryMembership" ALTER COLUMN "brandId" DROP NOT NULL;
ALTER TABLE "CategoryMembership" ADD COLUMN "projectId" TEXT REFERENCES "Project"(id) ON DELETE CASCADE;
ALTER TABLE "CategoryMembership" ADD CONSTRAINT membership_owner_check
  CHECK (("brandId" IS NOT NULL) != ("projectId" IS NOT NULL));
```

## Implementation plan

### Phase 1 — api (identity control plane)
1. Prisma schema: add `Project` model
2. Migration
3. NestJS module: `ProjectsModule` with CRUD (create, list by workspace, get, patch, delete/deactivate)
4. Expose via `GET /workspaces/:id/projects`, `POST /workspaces/:id/projects`, `PATCH /projects/:id`, `DELETE /projects/:id`
5. Service JWT guard on all routes (same as Brand)

### Phase 2 — nauthenticity
1. Prisma schema: add `Project` model + extend `CategoryMembership`
2. Migration
3. `ProjectsModule` (NestJS): upsert (called by api webhook or sync), get by id, list by workspace
4. Extend `CategoryMembership` create/list/delete to accept `projectId` OR `brandId`
5. Extend fanout processor and source-concept extraction to dispatch on project context
6. Extend workspace view API to return `{ brands: [...], projects: [...] }`

### Phase 3 — app.9nau.com
1. Workspace page: show Brands + Projects sections
2. Project list + create modal
3. Project detail: captures tab (add profiles/posts), concepts tab, chat tab
4. Calls nauthenticity API directly (same endpoints brands use, passing projectId)

### Phase 4 — nauthenticity dashboard
1. Workspace view: Brands section + Projects section (grouped)
2. Project detail view (reuses same components as Brand detail)

## Status

**In progress** — implementation starting Phase 1.
