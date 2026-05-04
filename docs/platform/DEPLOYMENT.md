# Deployment Guide

## Contents

1. [Architecture overview](#architecture-overview)
2. [**Production Deployment Protocol**](#production-deployment-protocol) ← read this before every push
3. [Domain mapping](#domain--service-mapping)
4. [CI/CD pipeline](#cicd-pipeline)
5. [Manual deploy & rollback](#manual-deploy-emergency)
6. [Database backups](#database-backups)
7. [Uptime monitoring](#uptime-monitoring)

---

## Production Deployment Protocol

> **Read this before every push to `main`.** The platform runs background jobs 24/7 — a careless deployment can corrupt in-flight queue jobs, break active renders, or interrupt ongoing scraping runs.

### The Golden Rule

**Never push to `main` while long-running background jobs are active for services you are touching**, unless the change is purely additive (new endpoint, new field, read-only frontend change) and carries no risk of restarting workers mid-job.

Services and their background processes:

| Service | Background processes |
|---|---|
| **flownau** | Remotion renders, cron publisher (post scheduler), internal cron |
| **nauthenticity** | BullMQ ingestion, download, optimization, compute workers |
| **api** | Scheduled jobs (if any), inter-service webhooks |
| **zazu-bot** | Long-polling / webhook handler |

---

### Before You Push

#### 1. Check the queue status

```bash
# Nauthenticity — check active/waiting jobs
ssh nau "docker exec nauthenticity curl -s http://localhost:3000/queue | jq '{download:.download.counts, compute:.compute.counts, optimization:.optimization.counts, ingestion:.ingestion.counts}'"
```

Wait for all queues to show `active: 0` before deploying nauthenticity.

```bash
# Flownau — check for active renders
ssh nau "docker exec flownau-renderer ps aux | grep ffmpeg | grep -v grep | wc -l"
```

Wait for 0 active ffmpeg processes before deploying flownau or flownau-renderer.

#### 2. Check for in-progress scraping runs

```bash
ssh nau "docker exec nauthenticity-postgres psql -U nauthenticity nauthenticity -c \"SELECT id, username, phase, status FROM \\\"ScrapingRun\\\" WHERE status = 'pending' OR phase NOT IN ('finished', 'idle');\""
```

If any run is in `downloading`, `optimizing`, or `visualizing` — wait until it finishes or [recover manually](#recovering-a-stuck-run) after deploy.

#### 3. Check for scheduled posts about to fire

The flownau cron publisher runs every 5 minutes. If a post is scheduled within the next 10 minutes, wait.

```bash
ssh nau "docker exec flownau-postgres psql -U flownau flownau -c \"SELECT id, status, \\\"scheduledAt\\\" FROM \\\"Post\\\" WHERE status = 'SCHEDULED' AND \\\"scheduledAt\\\" < NOW() + INTERVAL '10 minutes';\""
```

#### 4. Never push a schema migration without a deployment window

Prisma migrations run at container startup. If the migration is destructive (DROP COLUMN, ALTER TYPE), the old container is still serving traffic while the migration runs — this is a race condition.

**Protocol for schema changes:**
1. Only additive migrations (ADD COLUMN, CREATE TABLE, CREATE INDEX) can deploy without a window.
2. Destructive migrations require: first deploy application code that tolerates both old and new schema, then run the migration, then deploy the cleanup.
3. Never ALTER a column type in a single deploy — always: add new column → migrate data → remove old column.

---

### When Is It Safe to Push?

| Situation | Safe? |
|---|---|
| All queues idle, no scraping runs in progress | ✅ Yes |
| Only changing frontend / dashboard code (no server restart) | ✅ Yes |
| Additive-only backend change (new endpoint, new optional field) | ✅ Yes |
| Optimization queue draining (e.g., 200 jobs waiting) | ❌ Wait |
| Active ffmpeg render in progress | ❌ Wait |
| Scraping run in `downloading` or `optimizing` phase | ❌ Wait |
| Scheduled post firing within 10 minutes | ❌ Wait |
| Schema migration with DROP / ALTER | ❌ Plan a maintenance window |

---

### Preferred Deployment Window

**03:00–06:00 UTC** — low traffic, low likelihood of scheduled posts firing.

For any push that touches workers, queues, or schema: confirm queues are empty first, regardless of time of day.

---

### After Deploying

#### 1. Verify containers came up healthy

```bash
ssh nau "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'nauthenticity|flownau|api'"
```

All should show `healthy` or `Up X seconds`.

#### 2. Check worker startup logs

```bash
ssh nau "docker logs nauthenticity --tail=30"
```

Look for `All BullMQ workers ready`. If a scraping run was in-progress at deploy time, the startup recovery will log `[Recovery] Run ... stuck in ... — re-triggering ...` automatically.

#### 3. Verify queues resumed

```bash
ssh nau "docker exec nauthenticity curl -s http://localhost:3000/queue | jq '{download:.download.counts, optimization:.optimization.counts}'"
```

If a queue was active before deploy, jobs should resume automatically via startup recovery.

#### 4. Check for new failures

```bash
ssh nau "docker exec nauthenticity curl -s http://localhost:3000/queue | jq '{dlFailed:.download.counts.failed, optFailed:.optimization.counts.failed, computeFailed:.compute.counts.failed}'"
```

If any failed count jumped after deploy, check nauthenticity logs and recover manually if needed.

---

### Recovering a Stuck Run After Deploy

If a deploy interrupted an in-flight scraping run and startup recovery didn't advance it (check logs first):

```bash
# 1. Find the stuck run
ssh nau "docker exec nauthenticity-postgres psql -U nauthenticity nauthenticity -c \"SELECT id, username, phase FROM \\\"ScrapingRun\\\" WHERE status = 'pending';\""

# 2. Restart nauthenticity — startup recovery runs automatically on every boot
ssh nau "cd ~/apps/nauthenticity && docker compose restart nauthenticity"

# 3. Watch logs to confirm recovery fired
ssh nau "docker logs nauthenticity --tail=30 -f"
```

---

### Push Frequency & Batching

- **Batch related fixes** — don't push each individual commit as it's written. Group into coherent changesets.
- **Mid-process changes** — only push while jobs are running if the change is purely additive and doesn't restart any worker process.
- **Hotfixes** — if a bug is actively breaking users, it takes priority over job continuity. Drain the queues deliberately, deploy the fix, then re-trigger affected runs via the dashboard or recovery restart.

---

### Code Quality Gate (Before Every Push)

- [ ] TypeScript compiles without errors: `pnpm --filter <service> build`
- [ ] No `any` casts in queue/worker/schema code
- [ ] No hardcoded environment values (URLs, secrets, ports)
- [ ] If a new BullMQ queue is added: registered in `AnalyticsService.getQueueStatus()` and `WorkersService`
- [ ] If a schema migration is included: additive-only, or a maintenance window is planned
- [ ] If new transitional phases exist: startup recovery in `WorkersService.recoverStuckRuns()` covers them

---

## Architecture overview

```
GitHub (push to main)
  → GitHub Actions (CI/CD per service)
    → GHCR (ghcr.io/samuelaure/nau/<service>)
      → Hetzner VPS (46.62.252.13)
        └─ Docker Compose per service
           └─ Traefik reverse proxy (nau-gateway)
```

## Server directory structure

```
~/
├── traefik/
│   ├── docker-compose.yml   ← Traefik v3.3 gateway
│   ├── acme.json            ← Let's Encrypt certs (auto-managed by Traefik)
│   └── .env                 ← ACME_EMAIL
└── apps/
    ├── api/
    ├── accounts/
    ├── app/
    ├── flownau/
    ├── nauthenticity/
    │   └── storage/         ← persistent R2 local fallback
    ├── zazu-bot/
    ├── zazu-dashboard/
    └── whatsnau/
```

Each `apps/<service>/` directory contains:
- `docker-compose.yml` — committed in repo, synced by CI
- `.env` — written by CI deploy job from GitHub Secret `<SERVICE>_ENV_FILE`

## Domain → service mapping

| Domain | Service | Container |
|---|---|---|
| `api.9nau.com` | api | `api:3000` |
| `accounts.9nau.com` | accounts | `accounts:3000` |
| `app.9nau.com` | app | `app:3000` |
| `flownau.9nau.com` | flownau | `flownau:3000` |
| `nauthenticity.9nau.com` | nauthenticity | `nauthenticity:3000` |
| `zazu.9nau.com` | zazu-dashboard | `zazu-dashboard:3000` |
| `bot.9nau.com` | zazu-bot (webhook) | `zazu-bot:3000` |
| `whatsnau.9nau.com` | whatsnau | `whatsnau:3000` |

## Internal service URLs (Docker network)

Services on `nau-network` reference each other by container name:

| Target | URL |
|---|---|
| api | `http://api:3000` |
| nauthenticity | `http://nauthenticity:3000` |
| flownau | `http://flownau:3000` |
| zazu-bot | `http://zazu-bot:3000` |

## CI/CD pipeline

See [ADR-007](../decisions/ADR-007-cicd-pipeline.md) for full rationale.

### Per-service pipeline

```
push to main → test → build → publish (Docker → GHCR) → deploy (SSH)
PR           → test → build   (no image produced)
```

### GitHub Secrets required

| Secret | Description |
|---|---|
| `DEPLOY_SSH_HOST` | `46.62.252.13` |
| `DEPLOY_SSH_KEY` | Private key matching `~/.ssh/nau_hetzner` |
| `API_ENV_FILE` | Full `.env` content for api |
| `ACCOUNTS_ENV_FILE` | Full `.env` content for accounts |
| `APP_ENV_FILE` | Full `.env` content for app |
| `FLOWNAU_ENV_FILE` | Full `.env` content for flownau |
| `NAUTHENTICITY_ENV_FILE` | Full `.env` content for nauthenticity |
| `ZAZU_BOT_ENV_FILE` | Full `.env` content for zazu-bot |
| `ZAZU_DASHBOARD_ENV_FILE` | Full `.env` content for zazu-dashboard |
| `WHATSNAU_ENV_FILE` | Full `.env` content for whatsnau |

Set all secrets with: `bash scripts/set-gh-secrets.sh`

## Setting up a new environment

1. Copy `.env.example` to `.env.production` for each service and fill in values
2. Run `bash scripts/set-gh-secrets.sh`
3. SSH to server and ensure `~/apps/<service>/docker-compose.yml` is present
4. Push to `main` — the pipeline will build, push, and deploy

## First admin user (bootstrap)

On a fresh database the registration flow is invite-only, so the first user must be bootstrapped directly. Run once after the databases are up — it creates the platform workspace and prints a 30-day registration link locked to your email.

**Production (after first deployment):**
```bash
ssh nau
cd ~/apps/api
docker compose exec api npx tsx scripts/bootstrap-admin.ts
```

The script prints a registration link. Open it in a browser to create your admin account.

- Safe to run only once — exits with an error if any user already exists.
- The invite has OWNER role on the "naŭ Platform" workspace.
- Valid for 30 days.

**Dev:**
```bash
cd apps/api
DATABASE_URL="postgresql://nau_api:dev_api_password@localhost:5432/nau_api" \
ACCOUNTS_URL="http://localhost:3002" \
ADMIN_EMAIL="samuelaure@gmail.com" \
../flownau/node_modules/.bin/tsx scripts/bootstrap-admin.ts
```

---

## Manual deploy (emergency)

```bash
ssh nau
cd ~/apps/<service>
docker compose pull
docker compose up -d
```

## Rollback

Each push creates a `sha-<git-sha>` tagged image in GHCR. To roll back:

```bash
ssh nau
cd ~/apps/<service>
# Edit .env: TAG=sha-<previous-sha>
docker compose up -d
```

## Viewing logs

```bash
ssh nau "docker logs <container-name> --tail=100 -f"
# e.g.
ssh nau "docker logs api --tail=100 -f"
ssh nau "docker logs nauthenticity --tail=100 -f"
```

## Resource allocation (Hetzner CX33, 8GB RAM / 4 vCPU)

| Service | Memory limit | CPU limit |
|---|---|---|
| nau-gateway | ~50MB actual | — |
| api | 768M | 1.00 |
| accounts | 384M | 0.50 |
| app | 384M | 0.50 |
| flownau | 640M | 0.75 |
| flownau-renderer | 1792M | 1.50 |
| nauthenticity | 640M | 1.00 |
| zazu-bot | 384M | 0.50 |
| zazu-dashboard | 384M | 0.50 |
| Databases (×4) | 256–384M each | — |
| Redis (×4) | 128M each | — |
| **Total headroom** | **~1.5GB free** | — |

_whatsnau is deferred — not included in v1 deployment._

---

## Database backups

All five PostgreSQL databases are backed up nightly at **02:00 UTC** by the `nau-backup` container. Dumps are compressed with gzip and uploaded to a private Cloudflare R2 bucket (`nau-backups`, Infrequent Access). Backups older than 30 days are pruned automatically.

### Backup layout in R2

```
nau-backups/
├── api/           api-YYYY-MM-DD.sql.gz
├── flownau/       flownau-YYYY-MM-DD.sql.gz
├── nauthenticity/ nauthenticity-YYYY-MM-DD.sql.gz
├── zazu/          zazu-YYYY-MM-DD.sql.gz
└── whatsnau/      whatsnau-YYYY-MM-DD.sql.gz
```

### Starting the backup service

The `backup` service is defined in the root `docker-compose.yml`. It is **not started automatically by CI/CD** — start it once manually after first deployment and it will restart on its own from then on:

```bash
ssh nau
cd ~/          # root docker-compose.yml lives here
docker compose up -d backup
```

Verify it started:
```bash
docker logs nau-backup
```

### Environment variables required (root `.env`)

| Variable | Description |
|---|---|
| `BACKUP_R2_BUCKET_NAME` | `nau-backups` |
| `BACKUP_R2_ACCESS_KEY_ID` | R2 Account API Token access key (scoped to `nau-backups`) |
| `BACKUP_R2_SECRET_ACCESS_KEY` | R2 Account API Token secret key |
| `BACKUP_R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `API_DB_PASSWORD` | PostgreSQL password for `nau_api` |
| `FLOWNAU_DB_PASSWORD` | PostgreSQL password for `flownau` |
| `NAUTHENTICITY_DB_PASSWORD` | PostgreSQL password for `nauthenticity` |
| `ZAZU_DB_PASSWORD` | PostgreSQL password for `zazu` |
| `WHATSNAU_DB_PASSWORD` | PostgreSQL password for `whatsnau` ⚠️ **fill in before starting backup service** |

> ⚠️ `WHATSNAU_DB_PASSWORD` is currently empty in `.env.production` — set it once whatsnau has a production database before starting the backup container.

### Manual backup run (on demand)

```bash
ssh nau
docker exec nau-backup /usr/local/bin/backup.sh
```

### Restoring from backup

```bash
# 1. Download the dump from R2 (use rclone, aws CLI, or Cloudflare dashboard)
# 2. Decompress and restore:
gunzip api-2026-05-03.sql.gz
docker exec -i api-postgres psql -U nau_api -d nau_api < api-2026-05-03.sql
```

### Viewing backup logs

```bash
ssh nau "docker logs nau-backup --tail=50"
```

---

## Uptime monitoring

**Implementation:** `.github/workflows/uptime.yml` — a GitHub Actions scheduled workflow that runs every 5 minutes on GitHub's infrastructure (independent of the VPS).

**What it checks:**

| Endpoint | URL |
|---|---|
| api | `https://api.9nau.com/health` |
| accounts | `https://accounts.9nau.com` |
| app | `https://app.9nau.com` |
| flownau | `https://flownau.9nau.com` |
| nauthenticity | `https://nauthenticity.9nau.com/health` |
| zazu-bot | `https://bot.9nau.com/health` |
| zazu-dashboard | `https://zazu.9nau.com` |

**On failure:** sends a Telegram message to `UPTIME_TELEGRAM_CHAT_ID` via the Zazŭ bot listing every service that returned non-200 or timed out, with a link to the workflow run.

**GitHub Secrets required:**

| Secret | Value |
|---|---|
| `UPTIME_TELEGRAM_BOT_TOKEN` | The Zazŭ bot token |
| `UPTIME_TELEGRAM_CHAT_ID` | Your personal Telegram chat ID |

**To get your chat ID:** send any message to `@ZazuNauBot` on Telegram, then run:
```bash
ssh nau "curl -s 'https://api.telegram.org/bot<TOKEN>/getUpdates'" | grep -o '"id":[0-9-]*' | head -3
```

**To set secrets:**
```bash
gh secret set UPTIME_TELEGRAM_BOT_TOKEN --repo samuelaure/nau --body "<token>"
gh secret set UPTIME_TELEGRAM_CHAT_ID --repo samuelaure/nau --body "<chat-id>"
```

**Manual trigger:**
```bash
gh workflow run uptime.yml --repo samuelaure/nau
```
