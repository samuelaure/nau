# naŭ Mobile App — Architecture Refactor Plan

> Status: **Ready to implement** — all architectural decisions locked.
> Supersedes the earlier notes at the bottom of this file.

---

## Context

The naŭ mobile app (`apps/mobile`) and its web counterpart (`apps/app`) share the same
backend: `apps/api`. Mobile captures are already synced to the API via `/sync/push` and
`/sync/pull`, backed by the generic `Block` model. The current implementation has three
critical gaps:

1. `Block` has no ownership — no `userId`, no `workspaceId`. All users see all blocks.
2. Tags don't exist server-side — they live only in the mobile SQLite db.
3. Auth is a hardcoded service key (`secret_key_for_dev`), not real user identity.
4. Media lives on-device only — no cloud backup, no nauthenticity processing.

---

## Locked Architectural Decisions

| Topic | Decision |
|---|---|
| Block ownership | `userId` (creator) + `workspaceId` (container), both required |
| Orphaned blocks (no owner) | Assign to Samuel's Personal Workspace on migration |
| Tags placement | `api` database, workspace-scoped only |
| "Personal" tags | = tags under Personal Workspace (no separate user-scoped concept) |
| Tag hierarchy | `Tag.parentId` self-reference; top-level + sub-tags |
| R2 path convention | `mobile/{workspaceId}/{postUuid}/{filename}` |
| Restricted posts | Try download → oEmbed embed → link card with badge (three-tier) |
| Auth sequencing | Data layer first; keep manual `nau_user_id` in settings for now |
| nauthenticity pipeline | Reuse existing ScrapeRun pipeline (mobile capture = single-URL scrape) |
| Data migration target | Samuel's 968 posts → Personal Workspace `personal-2a41dba9` |
| Andi's 6 posts | Manual — she will add them herself |

### Key IDs (do not lose these)

| Entity | ID |
|---|---|
| Samuel (`samuelaure@gmail.com`) userId | `cmoq2tqwz000001n6fnjqjzcw` |
| Samuel — Personal Workspace | `cmoq2tqx3000101n6usl2vxbx` (`personal-2a41dba9`) |
| Samuel — Samuel Aure workspace | `0470a637810113fafb3728f0` (`nau-platform`) — NOT the same as Personal |
| Andi (`andiclinaz@gmail.com`) userId | `cmotv0peo002g01rs5vfkcm4t` |
| Andi — Personal Workspace | `cmotv0pet002h01rsodij7n9y` (`personal-44abf3d6`) |

### Existing labels to migrate (46 total → Tags under Samuel's Personal Workspace)

```
A Yo Puedo, AI, Andi, Business, Buy, Cool, Curiosities, Elegance, Emergency,
Feminity, Goal, Grateful, Health, Hogar, Homeschool, Humor, Ideas, Keep in mind,
Learn, Marco, Marriage, Masculinity, Meditate / Think about, Mindset, Music,
Networking, Other, Papá, Practice, Pregnancy, Read, Research, Safety,
Self-defense, Someday/Maybe, Stella, Strength, Survival, To Try, To do,
Training, Travel, UGC Agency, Vaxx, Watch Later, Wealth, Wisdom, dev
```

All 46 start as flat top-level tags. Re-parenting into workspace groups (e.g. `UGC Agency`
under Samuel Aure workspace) is done manually via UI after the tag UI is built.

---

## Mobile backup data summary (as of 2026-04-11)

- **968 active posts** (0 deleted in final state)
- 845 processed, 102 pending, 21 restricted
- 866 have `mediaData` — all Instagram CDN URLs + `localUri` on-device files
- No R2 storage yet (`storage_key` column not present in this backup)
- 960/968 have tags; 212 have frequency/spaced-repetition set
- All media URLs are expired Instagram CDN links — media must come from on-device files

---

## Implementation Phases

### Phase 1 — API: Block ownership + Tag schema (api)

**Files:** `apps/api/prisma/schema.prisma`, new migration

Schema changes (additive — safe to deploy anytime):

```prisma
model Block {
  // ADD these two columns:
  workspaceId  String?   // nullable during migration fill; required after Phase 5
  userId       String?   // nullable during migration fill; required after Phase 5
  // ... existing fields unchanged
}

model Tag {
  id           String   @id @default(cuid())
  workspaceId  String
  name         String
  parentId     String?
  color        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  workspace    Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  parent       Tag?       @relation("TagChildren", fields: [parentId], references: [id], onDelete: SetNull)
  children     Tag[]      @relation("TagChildren")
  blocks       BlockTag[]

  @@unique([workspaceId, name])
  @@index([workspaceId])
}

model BlockTag {
  blockId   String
  tagId     String
  block     Block  @relation(fields: [blockId], references: [id], onDelete: Cascade)
  tag       Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([blockId, tagId])
}
```

Also add `Workspace` → `Tag[]` relation and `Block` → `BlockTag[]` relation.
Run `pnpm --filter api prisma migrate dev --name add-block-ownership-and-tags`.

Tasks:
- [ ] Add `workspaceId?`, `userId?` to `Block`
- [ ] Add `Tag` model with `parentId` self-reference
- [ ] Add `BlockTag` join model
- [ ] Add indexes: `Block @@index([workspaceId])`, `Block @@index([userId])`
- [ ] Run migration
- [ ] Verify `pnpm --filter api build` passes

---

### Phase 2 — API: Block + Tag service/controller scoping (api)

Update all Block queries to scope by `workspaceId`. For now, keep backward-compat by falling
back to unscoped if `workspaceId` is null (temporary, removed in Phase 6).

Files: `blocks.service.ts`, `blocks.controller.ts`, `sync.service.ts`, `sync.controller.ts`

Tasks:
- [ ] `BlocksService.findAll`: add `workspaceId` filter when present
- [ ] `BlocksService.create`: accept + store `workspaceId` + `userId`
- [ ] `BlocksService.update`/`remove`: verify caller owns the block's workspace
- [ ] `SyncService.push`: accept `workspaceId` per block; set `userId` from caller context
- [ ] `SyncService.pull`: scope to `workspaceId` when provided
- [ ] `SyncCursor`: add `workspaceId` field; unique on `[userId, workspaceId]`
- [ ] Add `TagsController` + `TagsService` under `/workspaces/:id/tags`:
  - `GET /workspaces/:id/tags` — list (tree structure)
  - `POST /workspaces/:id/tags` — create `{ name, parentId? }`
  - `PATCH /tags/:id` — rename / re-parent
  - `DELETE /tags/:id` — delete (BlockTag cascade handles cleanup)
- [ ] Add `POST /blocks/:id/tags` and `DELETE /blocks/:id/tags/:tagId` endpoints
- [ ] Verify `pnpm --filter api build` passes

---

### Phase 3 — Data migration script (api)

One-time script at `apps/api/scripts/migrate-mobile-captures.ts`.

What it does:
1. Read the SQLite backup `tmp/nau-ig-backup-2026-04-11T20-52-09-042Z.db`
2. For each of the 968 active posts, create a `Block` via `prisma.block.upsert` with:
   - `uuid` = post's `uuid` (or generated if null)
   - `type` = `'CAPTURE_POST'`
   - `workspaceId` = `cmoq2tqx3000101n6usl2vxbx` (Samuel's Personal Workspace)
   - `userId` = `cmoq2tqwz000001n6fnjqjzcw` (Samuel)
   - `properties` = `{ instagramUrl, title, content, username, profileImage, instagramCaption, instagramUserId, biography, mediaData, syncStatus, smInterval, smRepetition, smEaseFactor, frequency, nextReviewAt, r2Status: null }`
   - `deletedAt` = null (backup has no deleted posts)
   - `source` = `'mobile'`, `sourceRef` = post `id` (SQLite row id as string)
3. Create `Tag` records for all 46 labels under Personal Workspace (skip duplicates)
4. For each post, parse `tags` JSON array → create `BlockTag` records linking block → tag
5. Assign existing orphaned Blocks (no `workspaceId`) to Samuel's Personal Workspace
6. Update `SyncCursor` for Samuel + Personal Workspace to `now()`

Run once: `npx ts-node apps/api/scripts/migrate-mobile-captures.ts`

Tasks:
- [ ] Write migration script
- [ ] Dry-run with `--dry-run` flag (logs what would be created, no writes)
- [ ] Execute on production DB (check queue status first per deployment protocol)
- [ ] Verify block count in DB matches 968
- [ ] Verify 46 tags created
- [ ] Remove script after successful run

---

### Phase 4 — Mobile: SQLite schema + workspace awareness (mobile)

Add `workspaceId` to the local SQLite schema and wire up workspace selection.

Tasks:
- [ ] Add SQLite migration v6: `ALTER TABLE posts ADD COLUMN workspaceId TEXT`
- [ ] Add SQLite migration v6: `ALTER TABLE posts ADD COLUMN storage_key TEXT` (if not already present — check device vs backup)
- [ ] Add SQLite migration v6: `ALTER TABLE posts ADD COLUMN r2_migration_status TEXT`
- [ ] `SettingsRepository`: add `getSetting('nau_workspace_id')` / `setSetting('nau_workspace_id', ...)`
- [ ] `SettingsModal`: add workspace selector — calls `WorkspacesService.fetchWorkspaces()`, displays list, persists chosen `workspaceId`
- [ ] `SyncService.push`: read `workspaceId` from settings, attach to each block in payload
- [ ] `SyncService.pull`: pass `workspaceId` as query param
- [ ] Default workspace for new captures = value from `nau_workspace_id` setting
- [ ] Verify existing posts get `workspaceId` backfilled from settings on migration

---

### Phase 5 — Mobile: Temp R2 media upload (mobile)

One-time-use upload feature to move on-device media to R2 before devices are cleared.
Lives in `SettingsModal`. Remove after both devices have completed upload.

Logic:
1. Load all posts where `r2_migration_status IS NULL` and `mediaData` contains a `localUri`
2. Show count + progress bar in Settings
3. For each post:
   a. Parse `mediaData` JSON → extract `localUri` entries
   b. Upload each file to `mobile/{workspaceId}/{uuid}/{filename}` via `R2UploadService`
   c. Build new `mediaData` replacing `localUri` CDN URL with R2 CDN URL, keeping `localUri` for cache
   d. Update post: `storage_key = JSON.stringify({ localUri: r2Key })`, `r2_migration_status = 'done'`
   e. Trigger nauthenticity processing (Phase 7) for this post
4. Posts where `localUri` files are missing (deleted from device) → mark `r2_migration_status = 'missing'`

Tasks:
- [ ] Add "Backup media to cloud" section in `SettingsModal`
- [ ] Show counts: pending / done / missing / error
- [ ] Implement upload loop with per-item error handling (don't abort on single failure)
- [ ] `R2UploadService`: verify it handles the `mobile/{workspaceId}/...` key prefix
- [ ] After upload: store R2 URL back into `mediaData` and sync the block
- [ ] Test with 1–2 posts before running full batch

---

### Phase 6 — nauthenticity: Mobile capture processing pipeline (nauthenticity)

Reuse the existing ScrapeRun pipeline to process mobile captures. A mobile capture is
treated as a single-URL profile scrape with a known post URL.

New endpoint: `POST /mobile/process-capture`
Auth: service JWT from api.

Input:
```json
{
  "instagramUrl": "https://www.instagram.com/reel/...",
  "workspaceId": "...",
  "blockId": "...",
  "mediaR2Key": "mobile/{workspaceId}/{uuid}/video.mp4"  // optional, if already uploaded
}
```

Processing flow:
1. If `mediaR2Key` provided (already on R2): skip download, go straight to optimize → transcribe → synthesize
2. If no `mediaR2Key`: create a ScrapeRun with `type = 'SINGLE_POST'`, `url = instagramUrl`
   - On download success: store to `mobile/{workspaceId}/{uuid}/...`
   - On download failure (restricted): attempt Instagram oEmbed
   - On oEmbed failure: set `status = 'embed_failed'` in block properties
3. After transcription + synthesis: write back to Block via api:
   - `PATCH /blocks/{blockId}` with updated properties: `{ mediaUrls, thumbnail, transcript, synthesis, processingStatus: 'done' }`
4. Restricted posts handling:
   - Download fails → try `https://graph.facebook.com/v20.0/instagram_oembed?url={instagramUrl}`
   - oEmbed succeeds → store `{ embedHtml, thumbnailUrl }` in block properties, `processingStatus: 'embedded'`
   - oEmbed fails → `processingStatus: 'restricted'`, `restrictedUrl: instagramUrl`

Tasks:
- [ ] Add `MobileCaptureController` + `MobileCaptureService` in nauthenticity
- [ ] Add `POST /mobile/process-capture` endpoint (service JWT auth)
- [ ] Implement the three-tier download strategy
- [ ] Wire media storage to `mobile/{workspaceId}/...` R2 prefix
- [ ] Add api integration: `PATCH /blocks/:id` call to write back processing results
- [ ] Register in `WorkersService` if a new queue is introduced (check against queue checklist)
- [ ] Verify `pnpm --filter nauthenticity build` passes

---

### Phase 7 — Mobile: Feed display updates (mobile)

Update the mobile feed to reflect the new data shape and processing states.

Tasks:
- [ ] `FeedItem`: add processing status badge (`pending` / `processing` / `done` / `embedded` / `restricted`)
- [ ] `FeedItem`: show R2 media if `storage_key` present, fall back to `localUri`, fall back to embed
- [ ] `FeedItem`: for `restricted` posts, show Instagram deep-link card with lock icon
- [ ] On scroll into view: if `localUri` missing but `storage_key` present, trigger on-demand R2 download + cache locally
- [ ] Tags: replace flat label list with hierarchical workspace tags (top-level + indented sub-tags)
- [ ] `CaptureModal`: replace tag picker with workspace-aware tag picker (fetches tags from api, creates inline)

---

### Phase 8 — API: Make workspaceId + userId required (api)

After Phase 5 (data migration) and Phase 4 (mobile workspace awareness) are confirmed clean:

Tasks:
- [ ] Verify zero Blocks have `workspaceId IS NULL` in production DB
- [ ] Run migration: `ALTER COLUMN workspaceId SET NOT NULL`, same for `userId`
- [ ] Remove backward-compat nullable fallbacks from `BlocksService`
- [ ] Verify `pnpm --filter api build` passes

---

### Phase 9 — Auth: Real login flow (mobile + api) [deferred]

Replaces the manual `nau_user_id` + `x-nau-service-key` approach with real JWT auth.

- Mobile login screen: email + password → `POST /api/auth/login` → store `access_token` + `refresh_token` securely (Expo SecureStore)
- Replace `x-nau-service-key` headers throughout mobile with `Authorization: Bearer {accessToken}`
- Auto-refresh on 401
- `SyncController`, `BlocksController`: switch from `ServiceAuthGuard` to `JwtAuthGuard`
- `WorkspacesService`: switch to JWT auth

Deferred until data layer is stable. Implement as a separate feature branch.

---

## File locations quick reference

| File | Purpose |
|---|---|
| `apps/api/prisma/schema.prisma` | Block + Tag + BlockTag schema changes |
| `apps/api/src/blocks/` | Block CRUD, scope to workspaceId |
| `apps/api/src/sync/` | Sync push/pull, workspaceId-scoped |
| `apps/api/src/tags/` | New: Tag CRUD |
| `apps/api/scripts/migrate-mobile-captures.ts` | One-time migration script |
| `apps/mobile/src/db/MigrationManager.ts` | SQLite migration v6 |
| `apps/mobile/src/components/SettingsModal.tsx` | R2 upload feature + workspace selector |
| `apps/mobile/src/services/SyncService.ts` | workspaceId in push/pull |
| `apps/mobile/src/services/R2UploadService.ts` | R2 upload (mobile/{workspaceId}/...) |
| `apps/mobile/src/components/FeedItem.tsx` | Processing status badges |
| `apps/nauthenticity/src/mobile/` | New: mobile capture processing module |

---

## Verification criteria (done = all of these pass)

- Samuel's 968 posts visible in `apps/app` feed scoped to Personal Workspace
- Andi's posts visible in her Personal Workspace (manual adds)
- All 46 tags appear in mobile tag picker, grouped by workspace
- Media loads from R2 on fresh device install (on-demand download)
- Restricted posts show embed or link card — no broken empty cards
- New capture from mobile appears in web app after sync
- nauthenticity processes a new mobile capture end-to-end (download → transcribe → synthesis → written back to Block)
- `Block` table has zero rows with `workspaceId IS NULL` after Phase 8

---

## Original user notes (verbatim, preserved for context)

> On the other hand, the naŭ Mobile App itself was an captured posts inbox... Of course,
> this should be accordingly refactored too to coexist in harmony with the new implementations.
> - All instagram captures will be processed by naŭthenticity, to centralize responsibility
>   ownership, however, being processed by naŭthenticity doesn't mean displayed on naŭthenticity...
> - What is currently attached to user + optional-tags, should be refactored into workspaces...
> - I have a bunch of captured posts in my old version app mobile, that data should be migrated
>   safely to the new architecture to be displayed again...
