# Deploy Plan — `feature/nauthenticity-kb-restructure` → `main`

**Date:** 2026-05-10
**Window:** 03:00–06:00 UTC (preferred)
**Engineer:** on-call / deployer

---

## Summary of changes

- nauthenticity: 7 migrations including `voicePrompt` DROP, `BrandSynthesis` DROP, new `CategoryMembership` table with XOR constraint
- api: 1 migration (`20260510093349`)
- flownau: 1 migration (asset split tracking) + **one-time normalization script** (see Step 5)
- Deploy order is strict: nauthenticity schema → nauthenticity code → api schema → api code → flownau schema + code → normalization script

---

## 1. Pre-deploy checklist

Complete every item before opening the deploy window.

### 1.1 Queue health — must be idle before proceeding

```bash
ssh nau "docker exec nauthenticity curl -s http://localhost:3000/queue | jq '{download:.download.counts, optimization:.optimization.counts, compute:.compute.counts}'"
```

All `active` counts must be 0. If any queue is active, wait and re-check. Do not proceed until queues are clear.

### 1.2 Branch and CI

- Confirm `feature/nauthenticity-kb-restructure` is merged to `main` (or merge now and wait for CI).
- Confirm GitHub Actions CI passes green for the merge commit — all three services (api, nauthenticity, flownau) must show clean builds.
- Note: `app` has a pre-existing `ArrowUp` lucide/React type conflict in `layout.tsx` that is **not** introduced by this branch. Do not deploy `app` as part of this window. Track it separately.

### 1.3 Capture current image SHAs for rollback

```bash
ssh nau "docker inspect nauthenticity --format '{{.Config.Image}}'"
ssh nau "docker inspect 9nau-api --format '{{.Config.Image}}'"
```

Record both values before touching anything.

---

## 2. Deploy sequence

### Step 1 — nauthenticity schema (migrations)

```bash
ssh nau
cd ~/apps/nauthenticity

# Pull the new image
docker compose pull nauthenticity

# Run migrations only — do not restart the worker yet
docker compose run --rm nauthenticity npx prisma migrate deploy
```

Migrations applied in order (Prisma applies all pending in sequence):
1. `20260509143902`
2. `20260509180000`
3. `20260509190000`
4. `20260509220000`
5. `20260510100000` — drops `voicePrompt` and `BrandSynthesis`
6. `20260510110000`
7. `20260510120000` — `CategoryMembership` XOR constraint

Verify output shows all 7 migrations applied with no errors. If any migration fails, **stop here** and go to rollback.

### Step 2 — nauthenticity code

```bash
# Restart the service with the new image
docker compose up -d nauthenticity
```

Wait 20 seconds, then verify healthy (see section 3).

### Step 3 — api schema (migration)

```bash
cd ~/apps/api

docker compose pull 9nau-api
docker compose run --rm 9nau-api npx prisma migrate deploy
```

Migration applied: `20260510093349`

Verify output shows 1 migration applied cleanly.

### Step 4 — api code

```bash
docker compose up -d 9nau-api
```

Wait 20 seconds, then verify healthy (see section 3).

### Step 5 — flownau schema + code

```bash
cd ~/apps/flownau

docker compose pull flownau
docker compose run --rm flownau npx prisma migrate deploy
docker compose up -d flownau
```

Migration applied: `20260510120000_asset_split_tracking`

Wait 20 seconds, then verify healthy (see section 3).

### Step 6 — one-time asset split normalization ⚠️

**Run only once, after flownau is healthy.**

This normalizes all existing VID assets longer than 27s into ≤27s segments so they qualify for b-roll selection. Always dry-run first.

```bash
# Dry-run — shows affected assets without writing anything
ssh nau "docker exec flownau npx tsx scripts/normalize-asset-splits.ts --dry-run"
```

Review the dry-run output. When satisfied:

```bash
# Execute for real
ssh nau "docker exec flownau npx tsx scripts/normalize-asset-splits.ts"
```

**Safe to re-run:** assets already marked `optimizationStatus='split'` are skipped automatically.

---

## 3. Health verification per service

### nauthenticity

```bash
# Health endpoint
ssh nau "curl -sf http://localhost:3001/health | jq ."

# Queue status — all workers should show waiting/0 active
ssh nau "docker exec nauthenticity curl -s http://localhost:3000/queue | jq ."

# Tail logs for startup errors
ssh nau "docker logs nauthenticity --tail=80"
```

Expected: health returns 200, no `Error` or `UnhandledPromiseRejection` in logs, workers register cleanly.

### api

```bash
# Health endpoint
ssh nau "curl -sf http://localhost:3000/health | jq ."

# Tail logs
ssh nau "docker logs 9nau-api --tail=80"
```

Expected: health returns 200, no migration errors, no schema mismatch errors.

### flownau

```bash
ssh nau "curl -sf http://localhost:3002/health | jq ."
ssh nau "docker logs flownau --tail=80"
```

Expected: health returns 200, no errors in logs, cron scheduler starts cleanly.

---

## 4. Rollback procedure

### Rollback nauthenticity

```bash
ssh nau
cd ~/apps/nauthenticity

# Pin the previous image SHA recorded in step 1.3
# Edit .env or docker-compose.override.yml to set:
#   NAUTHENTICITY_IMAGE=ghcr.io/org/nauthenticity:sha-<previous-sha>

docker compose up -d nauthenticity
```

**Schema rollback note:** The `voicePrompt` and `BrandSynthesis` drops in migration `20260510100000` are destructive and cannot be auto-reversed by Prisma. If you need to roll back past that migration, restore from the pre-deploy database snapshot (see your backup provider). Confirm a snapshot was taken before starting the deploy window.

The `CategoryMembership` table addition is additive and safe to leave in place even on a code rollback.

### Rollback api

```bash
ssh nau
cd ~/apps/api

# Pin previous SHA
# Edit .env or docker-compose.override.yml:
#   API_IMAGE=ghcr.io/org/9nau-api:sha-<previous-sha>

docker compose up -d 9nau-api
```

Migration `20260510093349` for api is additive — no rollback migration needed for the code rollback to work.

### Rollback flownau

```bash
ssh nau
cd ~/apps/flownau

# Pin previous SHA
docker compose up -d flownau
```

Migration `20260510120000_asset_split_tracking` is additive — safe to leave in place on a code rollback.

The normalization script is idempotent and has no rollback concern — already-split assets are untouched.

---

## 5. Post-deploy smoke tests

Perform these manually after both services are verified healthy.

### API

- `GET /health` returns 200.
- Create or update a project via the API — confirm the nauthenticity sync endpoint is called and returns without error (check nauthenticity logs during this action).
- Confirm `CategoryMembership` rows can be created via the appropriate API route: one with `brandId` set and `projectId` null, and one with `projectId` set and `brandId` null. Confirm a row with both set is rejected (XOR constraint active).

### nauthenticity

- Open the nauthenticity dashboard and confirm the brand intelligence views load without 500 errors.
- Trigger a manual ingestion for one brand and confirm the job moves through queues normally.
- Confirm queue stats endpoint still reports all expected queues: download, optimization, compute.

### flownau

- Open the flownau UI and confirm posts load without errors.
- Confirm the normalization script dry-run output matches expectations before running for real.
- After running the normalization script, spot-check one affected asset to confirm it now has `optimizationStatus='split'`.

### Zazu bot

- Send a test message to the Zazu bot and confirm it responds (bot uses api for identity — this validates the api is up and reachable from zazu-bot).

---

## 6. Known risks and mitigations

| Risk | Mitigation |
|---|---|
| `voicePrompt` / `BrandSynthesis` DROP is irreversible | Take a DB snapshot before the deploy window. Verify zero runtime consumers (already confirmed pre-merge). |
| `CategoryMembership` XOR constraint rejects existing bad rows | Verified all create paths are safe pre-merge. Migration will fail at `ALTER TABLE` if any existing rows violate — check migration output carefully. |
| api calls nauthenticity sync on every project write | Deploy nauthenticity code (step 2) before api code (step 4). If nauthenticity is unhealthy when api restarts, project writes will error. Monitor nauthenticity health between steps. |
| Worker jobs active during nauthenticity restart | Step 1.1 queue check enforces idle queues. If a long-running job starts between the check and the restart, nauthenticity startup recovery (`WorkersService.recoverStuckRuns`) will re-enqueue it. Mid-execution work is lost — accept this risk only if queues were confirmed idle. |
| `app` ArrowUp build error | Do not deploy `app` in this window. It has a pre-existing lucide/React type conflict in `apps/app/src/app/layout.tsx` that requires a separate fix. |
| CI flake on first merge commit | Wait for a clean green CI run before pulling images to the server. Never deploy from a red CI. |
| Normalization script run before flownau is healthy | Always run the script **after** Step 5 health check passes. Running against a half-started container risks partial writes. |
| Normalization script run twice on same data | Script is idempotent — `optimizationStatus='split'` assets are skipped. Re-running is safe. |
