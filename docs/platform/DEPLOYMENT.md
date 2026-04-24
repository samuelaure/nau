# Deployment Guide

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

## Resource allocation (Hetzner CX23, 3.7GB RAM)

| Service | Memory limit | CPU limit |
|---|---|---|
| nau-gateway | ~50MB actual | — |
| api | 512M | 0.50 |
| accounts | 256M | 0.30 |
| app | 256M | 0.30 |
| flownau | 384M | 0.40 |
| flownau-renderer | 1536M | 1.00 |
| nauthenticity | 384M | 0.70 |
| zazu-bot | 256M | 0.30 |
| zazu-dashboard | 256M | 0.30 |
| whatsnau | 384M | 0.50 |
| whatsnau-worker | 384M | 0.50 |
| Databases (×5) | ~128–256M each | — |
| Redis (×5) | 64M each | — |
