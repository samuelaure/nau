# Future — Brand-Level Collaboration

> Adding granular membership at the Brand level in addition to the existing Workspace level.

**Status:** scoped. Not needed for solopreneur/small-team use cases; becomes important when workspaces grow to 10+ brands and members.

---

## Context

Today, permissions live at the `Workspace` level:

- Every `WorkspaceMember` sees every `Brand` in the workspace.
- Workspace role (`OWNER | ADMIN | MEMBER`) applies uniformly across brands.

For a solo creator or small team (2–5 people, 2–10 brands), this is fine — everyone works on everything.

At larger scale (agency with 30 brands, a dedicated person per 5 brands), you want:

- Members who see only some brands.
- Members with different roles on different brands (admin on brand A, read-only on brand B).
- Brand-level guest users (e.g., external client reviews posts for their own brand only).

## Target

Add `BrandMember` as a sibling of `WorkspaceMember`:

```prisma
model BrandMember {
  id        String      @id @default(cuid())
  userId    String
  brandId   String
  role      BrandRole   @default(MEMBER)
  createdAt DateTime    @default(now())

  user   User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  brand  Brand @relation(fields: [brandId], references: [id], onDelete: Cascade)

  @@unique([userId, brandId])
}

enum BrandRole {
  MANAGER     // like ADMIN but scoped to this brand only
  MEMBER
  VIEWER      // read-only
}
```

### Resolution hierarchy

```
effectiveRole(user, brand):
  1. WorkspaceMember(user, brand.workspaceId).role  // workspace-level inheritance
  2. BrandMember(user, brand).role                   // brand-level override
  3. If neither → denied
```

Workspace role takes precedence where explicit:
- Workspace OWNER → implicit BrandRole.MANAGER on every brand.
- Workspace MEMBER + BrandMember(MANAGER) → MANAGER effective on that brand.
- Workspace non-member + BrandMember → brand-level only access (no workspace UI).

### Scope representation in JWT

Current: `scope: "workspace:X:owner brand:<all>:write"`

New: `scope: "workspace:X:owner brand:A:manager brand:B:viewer"` — explicit per-brand scopes.

## API surface additions

```
GET    /brands/:id/members
POST   /brands/:id/members
PATCH  /brands/:id/members/:userId
DELETE /brands/:id/members/:userId
```

Invite flow: similar to workspace invites. `BrandRole.VIEWER` is useful for external client review where the user has zero workspace access.

## Execution plan

Scheduled after first customer requests it. Additive change — existing workspace-only permissions remain the common case.

## Related

- [../platform/AUTH.md §6 Authorization model](../platform/AUTH.md#authorization-model-permissions)
- [../platform/ENTITIES.md §2 WorkspaceMember](../platform/ENTITIES.md#workspacemember)
