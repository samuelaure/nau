# Auto-Sync Cron — Planned Feature

> Status: **Planned** — not yet implemented due to resource constraints.
> Current state: Sync Profile is manual-only. See `apps/nauthenticity/src/nest/profile-sync/`.

## Goal

Automatically run `syncProfile()` on a schedule for all tracked social profiles, so post counts stay current without requiring manual intervention from the user.

## What exists today (manual trigger)

`POST /social-profiles/:id/sync` — user-triggered, protected by JWT.

Logic:
1. Fetch profile data from IG via Apify (profile-only, no posts) — updates `totalPostCount`, `profileImageUrl`
2. Count local nauthenticity posts for this profile
3. Delta comparison against last `ProfileSyncSnapshot`:
   - `igDelta = igCount_now - lastSnapshot.igCount`
   - `nauDelta = nauCount_now - lastSnapshot.nauCount`
   - If `igDelta == nauDelta` → all posts captured → save snapshot, done
   - If `igDelta > nauDelta` → missed posts → backfill + scrape
4. For OWN profiles: attempt flownau backfill first (fills gap from flownaŭ-published posts)
5. If gap remains: trigger date-based ingestion (`updateSync: true`) from `lastScrapedAt`
6. Persist `ProfileSyncSnapshot { igPostCount, nauPostCount, scrapeTriggered }`

## Planned: Scheduled Auto-Sync

### Scope

- **OWN profiles** (where `ownerId` is set): sync every 6h
- **Competitor/benchmark profiles**: sync once per day (low priority)
- **Comment-only profiles**: already handled by the existing comment ingestion cron — exclude

### Resource constraint

Each profile sync triggers one Apify `PROFILE` mode call (lightweight, ~$0.005 each). With 50+ profiles, daily cost is manageable but worth rate-limiting.

### Implementation plan

1. Add a BullMQ queue: `profile-sync.queue.ts`
2. Add a BullMQ worker: `profile-sync.worker.ts` — calls `ProfileSyncService.syncProfile()`
3. Register in `WorkersService.workers` array
4. Add a cron entry (similar to `internal-cron.ts` pattern) that enqueues all active profiles at the desired cadence
5. Add `recoverStuckRuns` handling in `WorkersService` for any `profile-sync` jobs stuck in a transitional phase

### Queue checklist (from CLAUDE.md)

When adding the queue:
- [ ] Register in `AnalyticsService.getQueueStatus()`
- [ ] Register `retry/clear/delete` in `AnalyticsService`
- [ ] Register worker in `WorkersService.workers` array
- [ ] Handle new phases in `WorkersService.recoverStuckRuns()`

### Cron schedule suggestion

```
OWN profiles:        0 */6 * * *   (every 6 hours)
Competitor profiles: 0 2  * * *    (daily at 02:00 UTC)
```

Deploy window: 03:00–06:00 UTC (same as worker-touching deploys — see DEPLOYMENT.md).
