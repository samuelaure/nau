# First Deployment Plan

**Date**: 2026-04-27  
**Status**: Ready to execute

## Pre-flight Checklist

- [x] Server cleaned (all containers removed except Traefik, volumes purged)
- [x] Traefik running and healthy
- [x] nau-network recreated
- [x] All CI/CD workflows audited and fixed
- [x] Prisma migration paths corrected (no more `cd apps/X` in containers)
- [x] pnpm filter names match package.json
- [x] docker-compose.yml synced to server before every deploy (SCP step)
- [x] GitHub Secrets synced and CRLF-cleaned
- [x] .env.production files complete and correct
- [x] NEXT_PUBLIC_* vars baked into Docker build-args
- [x] pgvector pulled by init job before nauthenticity deploy
- [x] 121 commits staged locally, ready to push

---

## Deployment Order

The services have dependencies. Deploy in this order to avoid connection failures at startup:

```
1. api          ← core backend; all other services depend on it
2. accounts     ← auth/SSO; app and flownau depend on it
3. nauthenticity ← independent except for inter-service calls to api
4. flownau      ← depends on api + accounts + nauthenticity
5. app          ← depends on api + accounts + nauthenticity + flownau
6. zazu-bot     ← depends on api
7. zazu-dashboard ← depends on api + zazu-bot (via zazu-postgres)
8. whatsnau     ← standalone (WhatsApp CRM)
```

Because all workflows trigger independently on push to main, GitHub Actions will start them all in parallel. This is fine — Docker's `depends_on` with healthchecks inside each compose file handles startup ordering within a single service stack. The nau-network DNS means services that aren't up yet will be retried by application-level reconnect logic.

---

## Triggering the Deployment

```bash
git push origin main
```

This pushes all 121 commits and triggers all CI/CD workflows simultaneously.

---

## Monitoring the Deployment

### GitHub Actions
Watch all workflow runs at: https://github.com/samuelaure/nau/actions

Expected timeline per service (roughly):
- `test` job: 2–4 min
- `build` job: 3–6 min  
- `publish` job (Docker build + push): 5–15 min (first build, no cache)
- `init` + `deploy` jobs: 1–3 min

Total wall time per service: ~15–25 min (first run with no GHA cache)

### Server — watch containers come up
```bash
ssh nau
watch -n 5 docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Check service logs if something fails
```bash
docker logs api --tail 50
docker logs flownau --tail 50
docker logs nauthenticity --tail 50
```

### Verify network connectivity between services
```bash
docker exec api ping -c 1 flownau-app    # or whatever container name
docker network inspect nau-network
```

---

## Expected First-Run Behaviors

1. **Prisma migrations** — each service will run `prisma migrate deploy` against a fresh database. Expect "Applied X migrations" in logs.
2. **pgvector** — nauthenticity-postgres starts as `pgvector/pgvector:pg16`. The first time Prisma migrates, it runs `CREATE EXTENSION IF NOT EXISTS vector` — this will succeed.
3. **Docker image cache** — first push has no GHA layer cache; subsequent pushes will be faster.
4. **nau-network** — init job recreates it idempotently. All services attach to it via `external: true` in docker-compose.yml.

---

## Rollback Plan

If a service fails and needs to be rolled back:

```bash
ssh nau
cd ~/apps/{service}
# Pull previous image
docker compose pull --policy always
# Or pin a specific sha:
# image: ghcr.io/samuelaure/nau/api:sha-{previous-sha}
docker compose up -d
```

To roll back the entire deployment, revert the git commit and push:
```bash
git revert HEAD
git push origin main
```

---

## Post-Deployment Verification

Run these after all services report healthy:

```bash
# API health
curl https://api.9nau.com/health

# Accounts SSO
curl https://accounts.9nau.com

# App
curl https://app.9nau.com

# Flownau
curl https://flow.9nau.com   # or https://flownau.9nau.com

# Nauthenticity
curl https://nauthenticity.9nau.com/health
```

Check Traefik dashboard for all routers showing green: https://traefik.9nau.com (if configured)

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| First Docker build slow (no cache) | Normal; subsequent pushes will be fast |
| pgvector image pull during init | Init job pulls it before nauthenticity deploy |
| Services start before dependencies are ready | Application-level retry; no hard ordering required |
| GitHub Secrets out of sync | Re-synced via gh CLI with CRLF cleanup |
| Stale docker-compose on server | SCP step in every deploy workflow ensures current version |
| Prisma migration fails on first run | Run `docker compose run --rm api npx prisma migrate deploy` manually |
