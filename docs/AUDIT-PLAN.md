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

### 2.6 Anti-hacking & hardening
- [ ] **Rate limiting** on auth endpoints (login, register, password reset) — max 5 attempts per IP per 15 min
- [ ] **Rate limiting** on API endpoints — max 100 req/min per IP (tighten for sensitive endpoints like `/auth/refresh`)
- [ ] **Account lockout** after 5 failed login attempts; unlock after 30 min or admin intervention
- [ ] **IP-based lockout** after 10 failed login attempts from same IP; blocks for 1 hour
- [ ] No debug modes left enabled in production (`NODE_ENV=production` actually disables them)
- [ ] No deprecated routes or legacy endpoints still accepting requests
- [ ] Security headers set on all responses:
  - [ ] `X-Frame-Options: DENY` (prevent clickjacking)
  - [ ] `X-Content-Type-Options: nosniff` (prevent MIME sniffing)
  - [ ] `Strict-Transport-Security: max-age=31536000` (force HTTPS)
  - [ ] `Content-Security-Policy` configured for each app (at minimum: `default-src 'self'`)
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Session revocation on logout — refresh token deleted from DB immediately
- [ ] Token revocation on password change — invalidate all existing refresh tokens
- [ ] No plaintext passwords in logs or error messages
- [ ] All external service calls (OpenAI, Apify, Instagram, Telegram) validate response signatures/checksums
- [ ] Database queries use parameterized statements exclusively (Prisma enforces this, verify no raw SQL escapes)

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

### 6.4 Disaster recovery & data protection
- [ ] Database backups are automated (frequency: daily minimum)
- [ ] Backup restoration has been tested (not just assumed to work)
- [ ] Backup location is offsite or in separate region from primary
- [ ] All persistent data is in named Docker volumes (not container filesystem)
- [ ] Sensitive data at rest is encrypted (Postgres encrypted password fields, Redis with requirepass)
- [ ] Log retention policy documented (how long logs kept, when rotated)
- [ ] SSL/TLS certificate expiration monitoring in place (alerts before 30-day window)

### 6.5 First-boot checklist
- [ ] API database schema created via `prisma migrate deploy`
- [ ] Zazu-bot database schema created via `prisma migrate deploy`
- [ ] whatsnau initial admin account created with strong password
- [ ] Telegram bot webhook registered at `https://bot.9nau.com`
- [ ] DNS records point all 8 domains to `46.62.252.13`
- [ ] Uptime monitoring GitHub Secrets set (`UPTIME_TELEGRAM_CHAT_ID`, `UPTIME_TELEGRAM_BOT_TOKEN`)

---

## 7. Dependency audit

### 7.1 Vulnerability scanning
- [ ] Run `pnpm audit` — check for high/critical CVEs and audit exceptions documented
- [ ] No high/critical vulnerabilities without documented mitigation or waiver
- [ ] Deprecated packages identified and plan for replacement (e.g. `jsonwebtoken` → `jose`)
- [ ] Direct dependencies pinned to specific versions (not `^` or `~`)
- [ ] Transitive dependencies reviewed for major version mismatches

### 7.2 Version consistency
- [ ] All Next.js apps on same major version (currently 15.x, App Router)
- [ ] NestJS services on same major version
- [ ] `@prisma/client` version matches `prisma` CLI version
- [ ] `pnpm` version pinned consistently (currently 10.14.0)
- [ ] Node.js version pinned in Dockerfiles (currently `node:20-alpine`)
- [ ] Check that `@nau/auth` uses `jose` (not deprecated `jsonwebtoken`) — ✓ confirmed

### 7.3 Supply chain hygiene
- [ ] No local patches or forks of major dependencies (use upstream or file issues)
- [ ] All `npm install` commands use `--frozen-lockfile` (builds reproduce exactly)
- [ ] No `node_modules` in git tracking
- [ ] `package-lock.json` / `pnpm-lock.yaml` committed (reproducibility)

---

## 8. DNS & TLS

### 8.1 DNS configuration
- [ ] A records created for all 8 subdomains pointing to `46.62.252.13`
  - `api.9nau.com`
  - `accounts.9nau.com`
  - `app.9nau.com`
  - `flownau.9nau.com`
  - `nauthenticity.9nau.com`
  - `zazu.9nau.com`
  - `bot.9nau.com`
  - `whatsnau.9nau.com` (deferred)
- [ ] DNS propagation verified (check with `dig` or `nslookup`)
- [ ] No DNS wildcards or overly broad records

### 8.2 TLS & certificates
- [ ] Traefik successfully obtains Let's Encrypt certs on first HTTPS request (after DNS is live)
- [ ] `acme.json` is not committed to git (covered by `.gitignore`)
- [ ] Certificate renewal is automatic (Traefik with Let's Encrypt handles this)
- [ ] ACME email configured for certificate renewal notifications
- [ ] TLS version enforced: minimum TLS 1.2 (Traefik default)
- [ ] HTTP → HTTPS redirect active on all services
- [ ] HSTS header configured on Traefik (Strict-Transport-Security)
- [ ] Certificate pinning not required (HPKP not configured; Let's Encrypt certificates are short-lived)

---

## 9. GDPR & Privacy compliance

### 9.1 Pre-deployment (required before first user)
- [ ] **Sensitive field encryption** — encrypt API keys (Instagram access tokens, OAuth tokens) stored in DB using AES-256 (already using `encrypt()` in flownau, verify this covers all fields)
- [ ] **No credential logging** — verify no service logs plaintext tokens, passwords, or API keys (check pino serializers strip sensitive fields)
- [ ] **Privacy policy published** — accessible at a public URL before any user signs up (use Termly/iubenda template, customise for naŭ)
- [ ] **OpenAI DPA signed** — accept OpenAI's Data Processing Addendum at platform.openai.com (required for GDPR compliance when sending user content to OpenAI)
- [ ] **Breach response runbook documented** — procedure: detect → assess scope → notify affected users within 72h → notify supervisory authority within 72h → post-mortem
- [ ] **Data minimisation documented** — list of all data collected per entity (User, Workspace, Brand, Post, SocialProfile) with legal basis for each field

### 9.2 Post-deployment — Month 1
- [ ] **User data export endpoint** — `GET /api/users/{id}/export` returns JSON of all user-owned data
- [ ] **User deletion endpoint** — `DELETE /api/users/{id}` cascades deletes to all owned data and notifies third-party services (Instagram token revocation, etc.)
- [ ] **Data retention policy enforced** — define and implement automatic deletion schedules (e.g. delete draft posts after 90 days, usage events after 12 months)
- [ ] **DPAs with all third-party processors** — Apify, Cloudflare R2, Hetzner, Telegram (assess if required)

### 9.3 Instagram OAuth — deferred (Phase 2)
Current approach uses direct access tokens (user provides manually). This is acceptable for MVP but:
- Tokens expire ~60 days (manual refresh required)
- Users cannot revoke from Instagram settings
- Does not scale beyond technical users

**Migration path:** Implement Meta OAuth flow when onboarding non-technical users or when token renewal complaints begin. Requires Meta Developer App approval (~5 days) and `instagram_basic` + `pages_read_engagement` permissions.

### 9.4 LLM provider abstraction — pre-deployment scaffold, swap post-launch
- [ ] **Pre-deployment:** Create `packages/llm-client/` with `LLMClient` interface; all OpenAI calls go through it
- [ ] **Post-deployment (Month 3+):** Evaluate self-hosted Llama 2 / Mistral on GPU server; plug in as alternative implementation behind feature flag
- [ ] **Privacy gain:** User content no longer leaves your infrastructure; eliminates need for OpenAI DPA for that subset of calls

---

## 10. Usage tracking & cost attribution

### 10.1 Pre-deployment (implement before first user — ~1 day)
Tracking must start from day one. Data cannot be reconstructed retroactively.

- [ ] **`UsageEvent` model** added to api Prisma schema:
  ```
  fields: id, workspaceId, brandId?, userId?, service, operation, quantity, unit, costUsd, metadata, recordedAt
  indices: [workspaceId + recordedAt], [service + recordedAt]
  ```
- [ ] **`POST /_service/usage/events`** endpoint in api (ServiceAuthGuard) — any service can emit a usage event
- [ ] **`GET /admin/usage/summary`** endpoint in api — aggregate cost by workspace/brand over date range
- [ ] **OpenAI usage instrumented** — both flownau and nauthenticity wrap OpenAI calls and emit events with `response.usage.total_tokens` and cost calculated from rate table
- [ ] **Apify usage instrumented** — nauthenticity reads `run.usageTotalUsd` from actor run response and emits event
- [ ] **`UNIT_COSTS` rate table** defined in `packages/config/` — maps service+operation to USD per unit; update when provider pricing changes

### 10.2 Post-deployment — Month 2
- [ ] **Quota enforcement middleware** — NestJS interceptor checks workspace's monthly usage against plan limit before allowing expensive operations
- [ ] **Plan tier definitions** — define what quota each plan includes (e.g. Free: 10k OpenAI tokens/month, Pro: 500k, Business: unlimited)
- [ ] **Usage dashboard (admin)** — per-workspace cost breakdown by service, date range, top consumers
- [ ] **Threshold alerts** — Telegram alert when workspace reaches 80% and 100% of monthly quota
- [ ] **R2 bandwidth tracking** — instrument Cloudflare R2 reads/writes via Cloudflare Analytics API or SDK wrapper
- [ ] **Render count tracking** — flownau-renderer emits usage event per video render

### 10.3 Post-deployment — Month 3+
- [ ] **User-facing usage page** — workspace owner sees their monthly consumption and cost breakdown
- [ ] **Billing integration** — Stripe metered billing consuming UsageEvent data
- [ ] **Invoice generation** — monthly summary per workspace with itemised third-party costs + margin
- [ ] **LLM provider swap** — when self-hosted LLM is running, reduce `costUsd` contribution from OpenAI; cost attribution remains valid

---

## Audit execution order

### Phase A — Blocking (must be done before deploying to server)
1. **Repository hygiene** (§1) — no secrets, artifacts, or excluded files in git history
2. **Secrets & credentials** (§2.2) — all env vars set, no defaults, strong passwords
3. **Anti-hacking hardening** (§2.6) — rate limiting, security headers, session revocation
4. **DNS** (§8.1) — A records live and propagated (Let's Encrypt won't issue without this)

### Phase B — Pre-launch (must be done before the first non-technical user)
5. **TLS certificates** (§8.2) — Let's Encrypt obtains certs successfully after DNS is live
6. **Application code** (§5) — service auth, migrations tested, no insecure env var fallbacks
7. **Infrastructure** (§3) — docker-compose correct, resource limits, named volumes
8. **GDPR pre-deploy** (§9.1) — field encryption, privacy policy, OpenAI DPA, breach runbook
9. **Usage tracking** (§10.1) — UsageEvent model + instrumentation live from day one
10. **Dockerfile & CI** (§4) — all images build reproducibly, no secrets in layers
11. **Dependency audit** (§7) — no high/critical CVEs without documented mitigation
12. **Operational readiness** (§6) — health checks, uptime monitoring, log rotation, backups
13. **First-boot checklist** (§6.5) — migrations, webhook registration, DNS verification

### Phase C — Post-deployment Month 1 (before charging users)
14. **GDPR user rights** (§9.2) — data export endpoint, deletion endpoint, retention schedules
15. **Usage quota enforcement** (§10.2) — plan tiers, threshold alerts, quota middleware

### Phase D — Post-deployment Month 3+ (as platform scales)
16. **Billing integration** (§10.3) — Stripe metered billing, invoices, user-facing usage page
17. **Instagram OAuth** (§9.3) — Meta app approval, OAuth flow, token auto-refresh
18. **Self-hosted LLM** (§9.4) — GPU server, Llama 2/Mistral evaluation, provider abstraction swap
19. **Log aggregation** (observability.md) — Axiom or Loki when SSH grep becomes painful
20. **Distributed tracing** (observability.md) — OpenTelemetry when cross-service latency is complained about

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
| Missing global exception filter in nauthenticity | High | ✅ Fixed — added AllExceptionsFilter |
| Missing error boundaries in Next.js apps | Medium | ✅ Fixed — added global-error.tsx to all 4 apps |
| zazu-bot uncaught launch error | Medium | ✅ Fixed — added .catch() handler |
| nauthenticity PORT default wrong (4000 vs 3000) | Low | ✅ Fixed |
| FLOWNAU_DEFAULT_WORKSPACE_ID used incorrectly | Medium | ✅ Fixed — removed, now requires JWT |
| Uptime monitoring not implemented | High | ✅ Fixed — GitHub Actions workflow every 5 min |
| nauthenticity missing /digest endpoint | High | ✅ Fixed — added _service/brands/:brandId/inspo/digest |
| All LLM calls referenced OpenAI/Groq directly | High | ✅ Fixed — getClientForFeature() + MODEL_REGISTRY abstraction |
| UsageEvent model and instrumentation missing | High | ✅ Fixed — UsageEvent schema, /usage/events endpoint, LLM + Apify instrumented |
| Security headers missing on NestJS apps | High | ✅ Fixed — helmet() added to api + nauthenticity |
| Security headers missing on Next.js apps | Medium | ✅ Fixed — CSP, HSTS, X-Frame-Options on all 4 apps |
| Rate limiting missing | High | ✅ Fixed — ThrottlerModule on api + nauthenticity; 5/15min on auth endpoints |
| `api` ALLOWED_ORIGINS no-throw fallback | Medium | ✅ Fixed — throws if ALLOWED_ORIGINS not set |
| `jwt.decode()` without verification in nauthenticity auth callback | High | ✅ Fixed — now uses jwt.verify() |
| ENCRYPTION_KEY insecure fallback in flownau | High | ✅ Fixed — throws on missing |
