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

---

## InspoBase Profiles — Currently Not Monitored

**Finding (2026-05-15):** The existing fanout cron (`runProactiveFanout`, every 15 min) only processes `CategoryMembership` where `category: 'COMMENT'`. InspoBase profiles (`category: 'INSPO'`) are entirely excluded — they are never scraped automatically. New posts from InspoBase accounts only appear in nauthenticity when a user manually triggers an ingest from the dashboard.

**User note:** This should be reviewed and improved.

### Proposed approach

Add InspoBase profiles to the auto-sync schedule at a lower cadence than comment profiles — they don't need near-real-time freshness, but should update regularly to feed the source concept and synthesis pipelines.

Suggested cadence: **once per day** (e.g. 03:00 UTC), per brand's active INSPO profiles.

Implementation options:
1. **Extend the existing auto-sync cron** (once built) — add `category: 'INSPO'` profiles to the daily competitor slot, triggering a lightweight ingest (new posts only, `updateSync: true`)
2. **Separate INSPO sync job** — keeps comment fanout (latency-sensitive) fully isolated from bulk INSPO ingestion (throughput-sensitive)

Option 2 is preferred: INSPO ingestion is heavier (full pipeline: download, transcribe, synthesize, embed) and should not share queue priority with the comment fanout which needs to be fast.

### Cron schedule suggestion

```
INSPO profiles:  0 3 * * *   (daily at 03:00 UTC, per brand)
```
