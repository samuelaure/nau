# ADR-007 — CI/CD pipeline: GitHub Actions → GHCR → SSH deploy

- **Status:** 🟢 Accepted
- **Date:** 2026-04-24

## Context

The platform consists of 8 deployable services, each built from the same monorepo but shipped as independent Docker images. We needed a pipeline that:

- Validates code correctness before any image is built or deployed
- Produces reproducible, immutable Docker images
- Deploys to a single Hetzner VPS running Docker Compose + Traefik
- Keeps deployment simple enough to operate without Kubernetes or an external CD platform
- Allows per-service deploys without redeploying unrelated services

## Decision

### Pipeline structure (per service)

```
push to main (paths filter)
  └─ test          → unit tests + coverage upload
       └─ build    → typecheck + pnpm turbo build
            └─ publish  [main only] → Docker build + GHCR push
                 └─ deploy  [main only] → SSH: write .env, docker compose pull && up -d
```

PRs trigger `test` + `build` only — no image is produced or deployed.

### Path filtering

Each workflow declares `paths:` triggers scoped to its own app directory and `packages/**`. A commit touching only `apps/api/**` triggers `ci-api.yml`; all other pipelines are skipped. This keeps CI time proportional to what changed.

### Image registry

GitHub Container Registry (`ghcr.io/samuelaure/nau/<service>`). Each image is tagged:
- `latest` — always points to the last successful main build
- `sha-<git-sha>` — immutable reference for rollback

GHCR is free for public repos and the token is the built-in `GITHUB_TOKEN` — no separate registry credential to manage.

### Deploy mechanism

`appleboy/ssh-action` SSHes into the production server and:
1. Writes the service's `.env` from the `<SERVICE>_ENV_FILE` GitHub Secret
2. Runs `docker compose pull && docker compose up -d` in the service's directory

No agent, no Kubernetes, no Helm. Simple and auditable.

### Secrets management: ENV_FILE pattern

Instead of one GitHub Secret per environment variable, each service has a single `<SERVICE>_ENV_FILE` secret containing the entire `.env` file content. Rationale:

- Adding a new variable requires updating one secret, not the workflow YAML
- Prevents workflow YAML drift when the variable set grows
- The secret is written verbatim to disk on the server — same format the app reads

**Windows line-ending safety:** the `scripts/set-gh-secrets.sh` script strips `\r` via `tr -d '\r'` before uploading. If CRLF slips into a secret, the `\r` appears as a literal character in the env file on Linux, silently breaking variable values.

### Docker build context

All images are built from the monorepo root (`context: .`) because pnpm workspace hoisting requires the full workspace for `pnpm install --frozen-lockfile` to work correctly. Individual Dockerfiles reference only their own app + shared packages, but the install step needs the root lockfile.

## Alternatives considered

### A. Deploy on the server by pulling the repo and running `pnpm build`

Rejected: server builds are slow, environment-dependent, and require Node/pnpm on the server. Docker images are the correct unit of deployment.

### B. Kubernetes / ECS / Fly.io

Rejected for current scale: the platform runs on a single Hetzner CX23 (3.7GB RAM). Kubernetes overhead would consume 30–40% of available memory. Docker Compose is the right tool until horizontal scaling is needed.

### C. ArgoCD / Flux (GitOps)

Rejected: requires a Kubernetes cluster. Revisit if/when migrating to k8s.

### D. Single monolithic workflow

Rejected: any commit would trigger a full rebuild of all 8 services (~40+ min). Path filtering and per-service workflows keep CI time under 10 min for typical single-service changes.

## Consequences

### Positive
- Each service is independently deployable — changing zazu-bot doesn't rebuild flownau
- Images are immutable and tagged by SHA — rollback is `docker compose pull <sha-tag>`
- Zero infrastructure overhead — no registry to maintain, no CI agents to manage
- PR feedback in ~3–5 min (test + typecheck); full deploy in ~8–15 min with cache

### Negative
- No automatic rollback on failed health check — manual intervention required post-deploy
- SSH deploy is not atomic — if the server goes down mid-deploy, compose may be in a partial state
- `latest` tag means concurrent deploys (two pushes in quick succession) could race

### Future improvements
- Add health-check step after deploy (curl the service endpoint, fail if non-200)
- Add Slack/Telegram notification on deploy success/failure
- Consider blue-green or canary deploys once traffic warrants it
