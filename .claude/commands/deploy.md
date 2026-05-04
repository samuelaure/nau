# /deploy — Pre-Deployment Checklist & Protocol

You are the **Deployer**. Execute the full pre-deployment checklist before pushing to `main`. This is the gate between local work and production.

Full protocol lives in `docs/platform/DEPLOYMENT.md`. This skill is the executable checklist form.

---

## Step 1: Security Gate (run /security first)

Before anything else, confirm the Security Constitution is satisfied:

```bash
# S1+S6: No DB ports exposed
grep -rn 'ports:' apps/*/docker-compose.yml -A5 | grep -E '(5432|6379)'

# S7: No .env.production committed
git ls-files | grep '\.env\.production'

# S11: Deployment workflows include docker system prune
grep -r 'docker system prune' .github/workflows/
```

Any violation → **STOP**. Fix before proceeding.

---

## Step 2: Queue Safety Check

```bash
ssh nau "docker exec nauthenticity curl -s http://localhost:3000/queue | jq '{ingestion:.ingestion.counts, download:.download.counts, optimization:.optimization.counts, compute:.compute.counts}'"
```

**All queues must show `active: 0` before deploying nauthenticity.**

```bash
ssh nau "docker exec flownau-renderer ps aux | grep ffmpeg | grep -v grep | wc -l"
```

**Must show `0` before deploying flownau or flownau-renderer.**

---

## Step 3: Active Run Check

```bash
ssh nau "docker exec nauthenticity-postgres psql -U nauthenticity nauthenticity -c \"SELECT id, username, phase FROM \\\"ScrapingRun\\\" WHERE status = 'pending' AND phase NOT IN ('finished');\""
```

Any active run → wait for it to complete, or explicitly acknowledge the risk (startup recovery will handle it).

---

## Step 4: Scheduled Posts Check

```bash
ssh nau "docker exec flownau-postgres psql -U flownau flownau -c \"SELECT id, \\\"scheduledAt\\\" FROM \\\"Post\\\" WHERE status = 'SCHEDULED' AND \\\"scheduledAt\\\" < NOW() + INTERVAL '10 minutes';\""
```

Any post scheduled in the next 10 minutes → wait.

---

## Step 5: TypeScript Build Check

Run the build for each service being changed:

```bash
pnpm --filter <service-name> build
```

Must pass with zero errors.

---

## Step 6: Push

```bash
git push origin main
```

Monitor at: https://github.com/samuelaure/nau/actions

Expected timeline per service:
- test + build: ~5–10 min
- Docker publish: ~5–15 min (faster with cache)
- deploy: ~2 min

---

## Step 7: Post-Deploy Verification

```bash
# Container health
ssh nau "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'nauthenticity|flownau|api'"

# Worker startup (nauthenticity)
ssh nau "docker logs nauthenticity --tail=30"
# Expect: "All BullMQ workers ready"
# If a run was in progress, expect: "[Recovery] Run ... stuck in ... — re-triggering ..."

# Queue status after deploy
ssh nau "docker exec nauthenticity curl -s http://localhost:3000/queue | jq '{download:.download.counts, optimization:.optimization.counts}'"

# Health endpoints
curl -s https://api.9nau.com/health
curl -s https://nauthenticity.9nau.com/health
```

---

## Safety Matrix (Quick Reference)

| Situation | Safe to push? |
|---|---|
| All queues idle | ✅ Yes |
| Additive-only backend change | ✅ Yes |
| Pure frontend / dashboard change | ✅ Yes |
| Optimization queue draining | ❌ Wait |
| Active ffmpeg render | ❌ Wait |
| Scraping run in progress | ❌ Wait |
| Scheduled post in < 10 min | ❌ Wait |
| Schema DROP / ALTER | ❌ Plan maintenance window |

---

## Rollback

Each push creates `sha-<git-sha>` tag in GHCR:

```bash
# On server: edit ~/apps/<service>/.env → TAG=sha-<previous-sha>
ssh nau "cd ~/apps/<service> && docker compose up -d"
```
