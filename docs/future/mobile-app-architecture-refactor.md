# naŭ Mobile App — Architecture Refactor Plan (moved)

> **This document has moved.** It now lives with the code it describes, at
> `docs/architecture-refactor.md` in the [`nau-mobile`](https://github.com/samuelaure/nau-mobile)
> repository.

It was written on the assumption that the mobile app lived in this monorepo at
`apps/mobile`. It does not, and never did: the app is a standalone repository, briefly
absorbed here and pulled back out on 2026-05-21.

Keeping the plan here made its phases hard to act on, because four of the nine are mobile-side
and could not be verified against this tree.

## What was true on this side

The API phases were implemented and are part of this repository's history:

| Phase | Status |
|---|---|
| 1 — `Block.workspaceId` / `Block.userId` + `Tag` / `BlockTag` | done, migration `20260521000000_add_block_ownership_and_tags` |
| 2 — Tags CRUD and workspace-scoped sync | done |
| 3 — Data migration | ran; 968 `CAPTURE_POST` blocks and 48 tags live in the API database |
| 8 — Make ownership columns required | not done; both are still nullable |

Phase 2 was also superseded by a stronger fix: `/blocks` was found unauthenticated in
production and locked down on 2026-07-31. See `apps/api/src/blocks/blocks.service.ts`.

Phase 6 (nauthenticity capture pipeline) was never started, and Phase 9 (real login) was
replaced by an opt-in account-linking model — the app stays local-first.
