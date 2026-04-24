# Pre-Deployment Audit Plan

**Purpose:** Objective senior-level audit of the naŭ Platform before the first production deployment.  
**Scope:** Full-stack — architecture, security, infrastructure, code quality, operational readiness.  
**Auditor stance:** Fresh eyes. Assume nothing. Verify everything.

---

## 1. Repository hygiene

### 1.1 Files that should not be committed
- [ ] No `.env`, `.env.*` (except `.env.example`) in git history
- [ ] No database dumps (`*.sql` outside migrations)
- [ ] No credential files, keys, or tokens
- [ ] No IDE/OS artifacts (`.DS_Store`, `Thumbs.db`, `.idea/`)
- [ ] No build artifacts (`dist/`, `.next/`, `coverage/`)
- [ ] No debug/log output files (`*_output.txt`, `tsc_errors.txt`)
- [ ] No agent working notes (`.agent/`)
- [ ] Check git history for previously committed sensitive files (`git log --all -- '*.env'`)

### 1.2 gitignore coverage
- [ ] All generated/local file patterns are covered
- [ ] `.env.production` is covered by `.env.*` pattern
- [ ] `acme.json` is excluded
- [ ] `scripts/node_modules/` excluded

---

## 2. Security audit

### 2.1 Authentication & authorisation
- [ ] **Access tokens** — short-lived (15 min), HttpOnly cookie, SameSite=Lax
- [ ] **Refresh tokens** — opaque, bcrypt-hashed in DB, 30 days, Path=/auth/refresh
- [ ] **Service JWTs** — signed with `AUTH_SECRET`, short-lived (60s), verified with `verifyServiceToken`
- [ ] **No shared `NAU_SERVICE_KEY`** — all inter-service calls use signed JWTs
- [ ] `AUTH_SECRET` is identical across all services (required for token cross-verification)
- [ ] `AUTH_SECRET` is a strong random value (min 32 chars, preferably 64 hex)
- [ ] No `jwt.decode()` usage anywhere (must use `jwt.verify()` / `jwtVerify`)
- [ ] Mobile bearer tokens use `Authorization: Bearer` not query strings

### 2.2 Secrets management
- [ ] No secrets in `docker-compose.yml` files (all via `env_file:`)
- [ ] No credential fallbacks in compose files (e.g. `:-admin123`, `:-password`)
- [ ] GitHub Secrets set for all 10 required secrets
- [ ] `DEPLOY_SSH_KEY` is an Ed25519 or RSA-4096 key (not RSA-2048)
- [ ] Production database passwords are strong (≥24 chars, random)
- [ ] Redis passwords are strong (≥24 chars, random)
- [ ] `AUTH_SECRET` is cryptographically random (`openssl rand -hex 32`)
- [ ] `CRON_SECRET` set for flownau cron endpoints
- [ ] `INITIAL_ADMIN_PASSWORD` for whatsnau is strong and removed after first login

### 2.3 Network security
- [ ] All services accessible only via Traefik (no exposed ports on app containers)
- [ ] Postgres containers have no host port binding
- [ ] Redis containers have no host port binding
- [ ] All services on `nau-network` (internal Docker bridge)
- [ ] Traefik HTTPS redirect active (HTTP → HTTPS)
- [ ] TLS via Let's Encrypt (check `acme.json` populated after first request)
- [ ] CORS `ALLOWED_ORIGINS` set to specific domains, not `*`

### 2.4 Input validation & injection
- [ ] API input validation via NestJS class-validator decorators on all DTOs
- [ ] No raw SQL string interpolation (Prisma ORM used throughout)
- [ ] No `eval()` or `Function()` with user input
- [ ] File upload endpoints validate MIME type and size
- [ ] Telegram webhook init data validated with HMAC (zazu-dashboard)

### 2.5 CSRF protection
- [ ] Double-submit cookie pattern (`x-nau-csrf` + `nau_csrf`) on state-changing requests
- [ ] SameSite=Strict on refresh token cookie
- [ ] SameSite=Lax on access token cookie

---

## 3. Infrastructure audit

### 3.1 Docker Compose
- [ ] All services have `restart: unless-stopped`
- [ ] All services have `logging` configuration (json-file, max-size, max-file)
- [ ] All services have `deploy.resources.limits` (memory + CPU)
- [ ] All stateful services have named volumes (not anonymous)
- [ ] All services that depend on postgres/redis use `condition: service_healthy`
- [ ] All healthchecks are meaningful (not just `CMD true`)
- [ ] No `privileged: true` or unnecessary capabilities
- [ ] No host mounts except `storage/` for nauthenticity

### 3.2 Traefik gateway
- [ ] Traefik v3.3 running
- [ ] HTTP → HTTPS redirect configured
- [ ] Let's Encrypt ACME email set
- [ ] `acme.json` permissions are `600` (required by Traefik)
- [ ] `exposedByDefault=false` — opt-in labelling
- [ ] All 8 services have Traefik labels
- [ ] Traefik dashboard is NOT exposed publicly

### 3.3 Resource allocation vs available RAM
Total server RAM: 8GB (Hetzner CX33). Verify all memory limits sum ≤ 7.5GB (leaving 0.5GB for OS).

Current allocation:
| Category | Total |
|---|---|
| App containers (7 services + renderer, whatsnau deferred) | ~5.4GB |
| Databases (4× postgres) | ~1.3GB |
| Redis (4×) | ~0.5GB |
| OS + Traefik | ~0.3GB |
| **Total** | **~7.5GB** |

✅ **Within budget.** ~500MB headroom at theoretical peak; realistic headroom is ~1.5GB since not all services hit limits simultaneously.

### 3.4 Persistent data
- [ ] All database volumes survive container restarts
- [ ] No critical data stored only in container filesystem
- [ ] `nauthenticity/storage/` bind mount is correct path on server
- [ ] Backup strategy exists for production databases

---

## 4. CI/CD pipeline audit

### 4.1 Workflow correctness
- [ ] All workflows trigger on correct `paths:`
- [ ] `publish` and `deploy` jobs have `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`
- [ ] `GITHUB_TOKEN` has `packages: write` permission for GHCR push
- [ ] `appleboy/ssh-action@v1` is pinned (not floating)
- [ ] Docker layer caching (`type=gha`) is configured
- [ ] All Dockerfiles build from monorepo root context

### 4.2 Dockerfile correctness
- [ ] `pnpm@10.14.0` version pinned in all Dockerfiles
- [ ] `node:20-alpine` used (not `node:latest`)
- [ ] Prisma `generate` runs in builder, before the compiled output is copied
- [ ] Next.js standalone output mode enabled in all Next.js apps
- [ ] Non-root user in Next.js runners (`nextjs` user, uid 1001)
- [ ] zazu-bot Dockerfile paths updated for monorepo (`apps/zazu-bot/`, `packages/zazu-db/`)
- [ ] zazu-dashboard Dockerfile paths updated for monorepo
- [ ] `whatsnau` Dockerfile — **OUT OF SCOPE** (whatsnau deferred, not deploying in v1)

### 4.3 Image security
- [ ] Base images are specific versions (not `latest`)
- [ ] No secrets in Dockerfile `ENV` layers
- [ ] `AUTH_SECRET` dummy in zazu-dashboard Dockerfile is clearly a placeholder (not a real secret)

---

## 5. Application code audit

### 5.1 API (NestJS)
- [ ] All endpoints have authentication guard (no accidentally public routes)
- [ ] `/_service/*` routes use `ServiceAuthGuard`
- [ ] `/auth/*` routes have appropriate rate limiting
- [ ] Prisma client not instantiated per-request (singleton)
- [ ] Error responses don't leak stack traces in production
- [ ] `NODE_ENV=production` disables verbose error details

### 5.2 Shared packages
- [ ] `@nau/auth` — `verifyServiceToken` throws on invalid token, not returns null
- [ ] `@nau/auth` — cookie builders set correct flags per ADR-004
- [ ] `@nau/types` — enums are stable (no values removed without migration)
- [ ] `@nau/sdk` — handles token refresh transparently (client-side 401 retry)

### 5.3 Service-to-service auth (ADR-004)
- [ ] All callers use `signServiceToken({ iss, aud, secret })` for outbound requests
- [ ] All receivers use `ServiceAuthGuard` or `verifyServiceToken` for inbound requests
- [ ] No remaining `x-nau-service-key` header usage in production paths
- [ ] Nauthenticity `src/modules/` legacy Fastify code — confirm it's dead code (not called)
- [ ] Flownau `src/modules/ideation/sources/inspo-source.ts` — uses `NAU_SERVICE_KEY` for outbound call to nauthenticity; needs migration to `signServiceToken`

### 5.4 Database migrations
- [ ] All Prisma migrations are present and in order
- [ ] Migration `20260423013410_init` is idempotent on a fresh database
- [ ] `prisma migrate deploy` runs at container startup (api, zazu-bot)
- [ ] Nauthenticity schema migration strategy confirmed (NestJS uses same DB as old Fastify schema?)

### 5.5 Environment variable usage
- [ ] No `process.env.X ?? 'fallback'` for security-sensitive vars in production code
- [ ] `flownau/src/lib/auth.ts` has `AUTH_SECRET ?? 'changeme'` — **must be fixed** before deploy
- [ ] All required env vars fail fast at startup if missing (validated in config module)

---

## 6. Operational readiness

### 6.1 Observability
- [ ] Structured logging (`@nau/logger` / pino) active in all services
- [ ] `LOG_LEVEL=info` set in all production envs
- [ ] Health check endpoints exist for each service (for future uptime monitoring)
- [ ] Docker log rotation configured (all services: `max-size: 10m, max-file: 3`)

### 6.2 Startup & shutdown
- [ ] All NestJS services call `app.enableShutdownHooks()`
- [ ] Database connections are closed gracefully on SIGTERM
- [ ] `depends_on: condition: service_healthy` prevents app from starting before DB is ready
- [ ] Prisma `migrate deploy` runs before the app starts (not just during build)

### 6.3 Error handling
- [ ] Unhandled promise rejections crash the process (so Docker restarts it) — confirmed by `--no-unhandled-rejections` not being set
- [ ] `restart: unless-stopped` ensures recovery from crashes

### 6.4 First-boot checklist
- [ ] API database schema created via `prisma migrate deploy`
- [ ] Zazu-bot database schema created via `prisma migrate deploy`
- [ ] whatsnau initial admin account created with strong password
- [ ] Telegram bot webhook registered at `https://bot.9nau.com`
- [ ] DNS records point all 8 domains to `46.62.252.13`

---

## 7. Dependency audit

- [ ] Run `pnpm audit` — check for high/critical CVEs
- [ ] Check that `@nau/auth` uses `jose` (not deprecated `jsonwebtoken`) — ✓ confirmed
- [ ] All Next.js apps on 15.x (App Router) — consistent version
- [ ] NestJS services on consistent major version
- [ ] Prisma client version matches `@prisma/client` in package.json
- [ ] No `node_modules` in git tracking

---

## 8. DNS & TLS

- [ ] A records created for all 8 subdomains pointing to `46.62.252.13`
- [ ] Traefik successfully obtains Let's Encrypt certs on first HTTPS request
- [ ] `acme.json` is not committed to git (covered by `.gitignore`)
- [ ] Certificate renewal is automatic (Traefik handles this)

---

## Audit execution order

1. **Repository hygiene** (blocking — fix before anything else)
2. **Secrets & credentials** (blocking — fix before deploy)
3. **DNS** (blocking — certs won't issue without it)
4. **Resource allocation** (assess — may need to defer some services)
5. **Application code findings** (fix critical issues, document accepted risks)
6. **Dockerfile & CI** (fix blocking items, note improvements)
7. **Operational checklist** (execute on first boot)

---

## Known pre-audit findings (from implementation session)

| Finding | Severity | Status |
|---|---|---|
| `flownau/src/lib/auth.ts`: `AUTH_SECRET ?? 'changeme'` fallback | High | ✅ Fixed — throws on missing |
| `nauthenticity/src/modules/` legacy `NAU_SERVICE_KEY` outbound calls | Medium | ✅ Dead code confirmed (app.module.ts only imports src/nest/) |
| `flownau/src/modules/ideation/.../inspo-source.ts`: `NAU_SERVICE_KEY` outbound to nauthenticity | Medium | ✅ Fixed — signServiceToken + correct endpoint |
| `flownau/inspo-source.ts` called non-existent `/api/inspo/digest` endpoint | High | ✅ Fixed — added `_service/brands/:brandId/inspo/digest` to nauthenticity |
| `whatsnau` missing Dockerfile | Medium | ⏸ Deferred — whatsnau out of scope for v1 |
| Total memory allocation exceeds server RAM | High | ✅ Resolved — server upgraded to 8GB RAM |
| zazu-bot/dashboard Dockerfiles updated for monorepo paths | — | ✅ Fixed |
| `INITIAL_ADMIN_PASSWORD:-admin123` fallback | Critical | ✅ Fixed |
| `REDIS_PASSWORD:-` empty default | High | ✅ Fixed |
| `NAU_SERVICE_KEY` in compose files | Medium | ✅ Fixed |
| `whatsnau` on isolated bridge network (not Traefik) | High | ✅ Fixed |
| `.agent/` directory in repo | Low | ✅ Fixed |
| `full.sql`, `*_output.txt` in repo | Low | ✅ Fixed |
