# Pre-Deployment Audit Plan

**Purpose:** Objective senior-level audit of the naŭ Platform before the first production deployment.  
**Scope:** Full-stack — architecture, security, infrastructure, code quality, operational readiness.  
**Auditor stance:** Fresh eyes. Assume nothing. Verify everything.

---

> ## ⚠ AGENT STOP — READ THIS BEFORE DOING ANYTHING ELSE
>
> This audit plan has been meta-audited and a set of structural issues, contradictions, and gaps were identified. **You must present these notes to the user and reach explicit agreement on how to handle each one before you proceed with any audit work.** Do not skip this step, do not assume the answers, do not begin checking items in the plan. Start the conversation with: *"Before I begin the audit, there are pre-audit notes that need your decision on several points."* Then walk through the sections below one by one.
>
> ---
>
> ### META-AUDIT NOTES — require user decision before proceeding
>
> #### A. Internal contradictions (the plan is self-inconsistent on these points)
>
> 1. **Next.js version — §7.2 vs §12.1.** §7.2 states all apps are on Next.js 15.x. §12.1 documents `app`, `flownau`, `accounts` on 14.2 and only `zazu-dashboard` on 15.3. One of these is wrong. **Decision needed:** verify actual versions in `package.json` files and reconcile.
> 2. **`nauthenticity` route name — §12.6 vs §12.7.** §12.6 says `/workspaces` is "already correct"; §12.7 says rename it to `/dashboard`. **Decision needed:** pick one and remove the other.
> 3. **Service count — §3.3 vs §8.1.** §3.3 says "7 services + renderer"; §8.1 lists 8 subdomains (one deferred). The resource table doesn't tie out. **Decision needed:** confirm exactly how many containers run in v1.
> 4. **§2.6 "validate response signatures/checksums" on OpenAI/Apify/Instagram.** Most of those APIs don't sign responses — this checkbox is a category error. The real checks are (a) validate inbound webhook signatures (Telegram HMAC, Stripe, Meta), and (b) validate response shapes with zod. **Decision needed:** rewrite or remove this item.
>
> #### B. Stale open checkboxes (already fixed, but still appear as `[ ]`)
>
> These items are marked ✅ in the Known Findings table at the bottom of the plan but still appear as open `[ ]` checkboxes in the body — they will generate false work:
>
> - §5.5: `flownau/src/lib/auth.ts AUTH_SECRET ?? 'changeme'` — already fixed
> - §5.3 last bullet: `flownau inspo-source.ts NAU_SERVICE_KEY` — already fixed
> - §9.4: "Create `packages/llm-client/`" — already done as `MODEL_REGISTRY`/`getClientForFeature()`
> - §3.3: memory allocation table may be stale post-server-upgrade
>
> **Decision needed:** mark these done in place, or remove them.
>
> #### C. Missing audit categories (significant gaps — not currently in the plan at all)
>
> The following topics are entirely absent. **Decision needed for each:** add as a new section, defer to a separate document, or explicitly mark out of scope.
>
> | Topic | Why it matters |
> |---|---|
> | **Accessibility (a11y)** | §12 standardises visual UX but omits WCAG, keyboard nav, focus order, color contrast, ARIA |
> | **Internationalisation (i18n)** | `zazu-dashboard` is hardcoded Spanish; no locale detection or translation strategy exists |
> | **SEO / metadata / OG / robots.txt / sitemap** | Landing pages exist but no audit of `<title>`, `<meta>`, OG tags |
> | **Email deliverability** | Outbound emails not mentioned; SPF/DKIM/DMARC for `9nau.com` missing from §8 DNS |
> | **Webhook security** | Telegram, Apify, future Stripe — signature verification, replay protection, idempotency |
> | **Cron & job processor audit** | `CRON_SECRET` mentioned but no job inventory, retry/DLQ, `fanout.processor.ts` not audited |
> | **Testing & CI gates** | No coverage thresholds, no required green check before merge, no post-deploy smoke tests |
> | **Staging / preview environment** | Plan assumes direct prod deploy; no staging strategy exists |
> | **Rollback strategy** | No image-tag versioning policy, no procedure for reverting a bad deploy |
> | **MFA / password policy / session management** | No TOTP for admins, no password complexity rules, no HIBP check, no active-session revocation UI |
> | **PII handling beyond passwords** | §2.6 covers passwords in logs but not emails, IPs, or content data — no data classification taxonomy |
> | **Audit log (security log)** | Distinct from operational logs: who did what, when — required for forensics |
> | **Performance / SLOs** | No latency targets, cold-start budget, N+1 query audit, or DB index audit |
> | **API contract & versioning** | No OpenAPI generation, breaking-change policy, or API version prefix strategy |
> | **Rate-limit storage** | In-memory rate limits are lost on restart and inconsistent across replicas; Redis-backed? |
> | **License & DPA inventory** | §9.2 vague — need a table: processor → DPA status, licence → compliant? |
> | **Time/clock standard** | UTC everywhere? TZ in cookies, JWTs, cron jobs? Currently silent |
> | **First-deploy runbook** | §6.5 is a *what* checklist; no *how* — no command-by-command deploy procedure |
> | **Production-ready exit criteria** | No definition of "audit complete" — when is the platform cleared to ship? |
> | **Health monitoring** | Standarized /health monitoring on all services |
>
> #### D. Weak checks lacking acceptance criteria
>
> These items are unfalsifiable as written — there is no way to objectively close them:
>
> - §5.1 "All endpoints have authentication guard" — how to verify? Needs: enumeration method + documented public-routes allowlist
> - §6.1 "Health check endpoints exist" — needs: URL pattern, expected status code, payload shape
> - §3.4 "Backup strategy exists" — needs: tool, schedule, retention period, restore-test frequency
> - §5.5 "All required env vars fail fast" — needs: per-service variable list published in `docs/env-vars.md`
> - §7.1 "audit exceptions documented" — needs: where? which file?
> - §2.6 "No deprecated routes still accepting requests" — needs: enumeration
>
> **Decision needed:** either add acceptance criteria inline, or defer to a verification-method appendix.
>
> #### E. Severity miscalibrations
>
> - **`nauthenticity` logout not revoking refresh token in DB** — rated Medium, should be **High**. A logged-out user's refresh token stays valid; same class as §2.6 "Session revocation on logout".
> - **SSO redirect parameter split** (`continue` vs `redirect_uri`) — rated Medium. The only reason it doesn't currently break SSO is the receiver reads both keys. It's a fragility/tech-debt landmine, not a live vulnerability. Consider re-rating Low with that note.
>
> #### F. Sequencing / structural issues
>
> - **§11 and §12 are not in the "Audit execution order"** (Phase A–D). They were added to the body but never integrated into the phase plan. §11.3 (`zazu-dashboard AUTH_SECRET ?? 'changeme'`) is a security blocker that belongs in **Phase A**.
> - **The plan's scope has grown beyond "pre-deployment audit".** It now contains: (a) deploy blockers, (b) multi-month platform-coherence projects (UI tokens, component library, route naming), and (c) a product roadmap (billing, Instagram OAuth, LLM). **Decision needed:** split into separate documents? Suggested split:
>   - `AUDIT-PLAN.md` — true pre-deploy gate (§1–§8 core, security blockers from §11)
>   - `PLATFORM-HEALTH.md` — ongoing coherence work (most of §11, §12)
>   - `ROADMAP.md` — post-deploy items (§9.3, §9.4, §10.2/10.3, Phase D)
> - **Known Findings table is doing two jobs** — historical fix log AND open issue tracker. Needs an `Owner` and `Estimated effort` column, or split into two tables.
>
> #### G. Correctness items to verify before treating the plan as authoritative
>
> - Does `@nau/auth/nextjs` subpath export actually exist? `flownau` middleware imports from it; a missing export breaks the build silently.
> - Does `@nau/auth` export a NestJS-compatible `verifyAccessToken`? §11.3 prescribes it but doesn't confirm it exists.
> - Does `getOrRefreshSession` call the API to refresh the token, or only verify locally? The plan assumes the former throughout.
> - Are both `jsonwebtoken` and `jose` in the dependency tree? If yes, that's a §7.1 finding — two competing JWT libraries.
>
> ---
>
> **Once the user has made decisions on A–G above, update the plan accordingly, then begin the audit.**

---

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

## 11. Cross-platform standardisation

> **Purpose:** Every app in the platform participates in the same SSO and authentication contract. Divergence between apps is a security and maintenance liability — a mismatch in redirect parameter name, cookie domain, or callback URL pattern is enough to silently break SSO for users on one app while others keep working. This section audits every deviation from a single standard and produces a concrete remediation plan.

### 11.1 SSO redirect parameter name

**Finding:** Two different query-string keys are used to pass the post-login redirect target to `accounts`:

| App / location | Parameter used | Example |
|---|---|---|
| `app` — middleware + landing page | `redirect_uri` | `?redirect_uri=https://app.9nau.com/home` |
| `flownau` — middleware + `lib/auth.ts` | `continue` | `?continue=https://flownau.9nau.com/auth/callback` |
| `nauthenticity` — NestJS callback controller | `continue` | `?continue=https://nauthenticity.9nau.com/auth/callback` |
| `nauthenticity` — Vite SPA `dashboard/src/lib/auth.ts` | `continue` | (same) |
| `zazu-dashboard` — login page | `continue` | `?continue=https://zazu.9nau.com/auth/callback` |
| `accounts` middleware (the receiver) | reads **both** | `params.get('redirect_uri') ?? params.get('continue')` |

`accounts` currently papers over the split by reading both keys, masking the inconsistency. This is a silent tech-debt trap: if `accounts` ever normalises to one key, the apps using the other will break silently.

**Target standard:** one canonical parameter — `redirect_uri` (follows OAuth 2.0 / OIDC spec naming). All apps MUST use `redirect_uri`; `accounts` middleware drops the `continue` fallback.

- [ ] `flownau/src/middleware.ts` — replace `continue` with `redirect_uri`; target URL should be the post-auth destination directly (e.g. `/dashboard`), not `/auth/callback`
- [ ] `flownau/src/lib/auth.ts` — same
- [ ] `nauthenticity/src/nest/auth/auth-callback.controller.ts` — replace `continue` with `redirect_uri`
- [ ] `nauthenticity/dashboard/src/lib/auth.ts` — replace `continue` with `redirect_uri`
- [ ] `zazu-dashboard/app/login/page.tsx` — replace `continue` with `redirect_uri`
- [ ] `accounts/src/middleware.ts` — once all callers are migrated, remove the `?? params.get('continue')` fallback

### 11.2 Post-login callback pattern

**Finding:** Each app implements a different strategy for completing the SSO handshake:

| App | Strategy | Notes |
|---|---|---|
| `app` | No callback page — middleware reads `nau_at` cookie directly; `redirect_uri` points to the target page (`/home`) | Cleanest pattern |
| `flownau` | Dedicated `/auth/callback` server component — reads `nau_at` cookie and redirects to `/dashboard` | One extra redirect for no gain |
| `nauthenticity` (NestJS) | Dedicated NestJS `GET /auth/callback` controller — reads cookie, verifies JWT, redirects to `/` | Duplicates logic already in `@nau/auth` |
| `nauthenticity` SPA | Vite app calls `/auth/me` to poll session state after redirect | Relies on the NestJS controller above |
| `zazu-dashboard` | Dedicated `/auth/callback` client component — fetches `/api/auth/nau-token`, then calls NextAuth `signIn('nau-sso', ...)` | Doubles the round trips; bridges two auth systems |
| `whatsnau` | No SSO — standalone email/password with its own `token` cookie (7-day, no refresh) | Completely out of the platform auth system |

**Root cause:** The `/auth/callback` intermediate page was introduced in `flownau` and `nauthenticity` as a landing pad before the `@nau/auth` package matured to handle session reading in middleware. `app` (built later) correctly skips it. The pattern is now obsolete for Next.js apps.

**Target standard:** All Next.js apps follow the `app` pattern — middleware calls `getOrRefreshSession`, unauthenticated requests redirect to `accounts/login?redirect_uri=<destination>`, no intermediate callback page. `zazu-dashboard` is a special case because it bridges NextAuth + naŭ SSO; it may need its own callback page but should be the only exception and must be explicitly documented.

- [ ] `flownau` — remove `src/app/auth/callback/page.tsx`; update middleware to redirect directly to `/dashboard` via `redirect_uri`; update `matcher` to remove `auth/callback` exclusion
- [ ] `flownau/src/lib/auth.ts` — `requireAuth()` already redirects to `accounts/login`; change `callbackUrl` to point directly to intended destination, not `/auth/callback`
- [ ] `nauthenticity` NestJS `AuthCallbackController` — evaluate whether the `/auth/callback` + `/auth/me` + `/auth/logout` endpoints can be replaced with Next.js middleware if the dashboard migrates away from Vite; if Vite stays, document this as the intentional exception
- [ ] `zazu-dashboard` — document as intentional bridge pattern; keep `/auth/callback` but clean up the multi-fetch flow (see §11.5)

### 11.3 `@nau/auth` package usage inconsistency

**Finding:** Apps use different import paths and bypass the shared package entirely in some cases:

| App | Import | Note |
|---|---|---|
| `app/src/middleware.ts` | `@nau/auth` | Correct |
| `flownau/src/middleware.ts` | `@nau/auth/nextjs` | Sub-path export — check if this diverges from main |
| `flownau/src/lib/auth.ts` | `@nau/auth` | Correct |
| `nauthenticity` NestJS callback | `jsonwebtoken` directly | Bypasses `@nau/auth`; manual `jwt.verify()` with config-level fallback logic |
| `zazu-dashboard/auth.ts` | `jose` directly | Bypasses `@nau/auth`; manual `jwtVerify` with `AUTH_SECRET ?? 'changeme'` fallback |

The `AUTH_SECRET ?? 'changeme'` fallback in `zazu-dashboard/auth.ts:95` is an unfixed **High** severity security finding — it was fixed in `flownau` but missed here.

- [ ] **Critical:** `zazu-dashboard/auth.ts` — replace `process.env.AUTH_SECRET ?? "changeme"` with a hard throw; add to Known Findings table
- [ ] Audit whether `@nau/auth/nextjs` sub-path export (`flownau` middleware) exports the same `getOrRefreshSession` as the main `@nau/auth` entry — consolidate to one import path
- [ ] `nauthenticity` NestJS callback — replace direct `jwt.verify()` calls with `@nau/auth` utilities (`verifyAccessToken` / `getSessionFromCookieStore`) to keep JWT verification logic in one place
- [ ] Verify `@nau/auth` exports a `verifyAccessToken` that can be used in NestJS contexts without the Next.js cookie API

### 11.4 Cookie names and flags

**Finding:** Legacy code references cookie names that no longer exist, and `whatsnau` operates an entirely separate cookie jar:

| Location | Cookie name | Status |
|---|---|---|
| All active apps | `nau_at` (access), `nau_rt` (refresh) | ✅ Standard |
| `nauthenticity/src/utils/auth.ts` (Fastify legacy) | `nau_token` | Dead code — cookie name no longer issued anywhere |
| `whatsnau` auth | `token` (generic) | Standalone — not part of platform SSO; no `Domain=.9nau.com` |

- [ ] Confirm `nauthenticity/src/utils/auth.ts` is unreachable dead code (not imported by `src/nest/`); if confirmed, delete the file
- [ ] `whatsnau` standalone `token` cookie: when SSO is eventually added to whatsnau, ensure it adopts `nau_at`/`nau_rt` naming and `.9nau.com` domain; flag as out-of-scope for v1 but document the migration requirement

### 11.5 Auth library strategy — `zazu-dashboard` bridge

`zazu-dashboard` uses NextAuth.js with a custom `nau-sso` credentials provider, sitting alongside the platform's `@nau/auth` cookie system. The current callback flow is:

1. Browser hits `accounts/login?continue=...`
2. `accounts` sets `nau_at` cookie on `.9nau.com`
3. Browser lands on `zazu-dashboard/auth/callback`
4. Client JS fetches `/api/auth/nau-token` (reads the `nau_at` cookie server-side)
5. Client calls `signIn('nau-sso', { token })` to create a NextAuth session
6. Browser now holds both `nau_at` (platform cookie) and a NextAuth `__Secure-next-auth.session-token`

This is a two-session problem: the user has a platform cookie AND a NextAuth session. They can expire independently. A token refresh on the platform side (new `nau_at`) does not update the NextAuth session.

- [ ] Document intentionally why `zazu-dashboard` uses NextAuth (Telegram Mini App auth requires a separate provider model)
- [ ] Implement session sync: when `nau_at` is refreshed, invalidate and re-issue the NextAuth session (or rebase the NextAuth JWT on the `nau_at` expiry instead of its own TTL)
- [ ] Evaluate long-term: if zazu-dashboard ever drops the Telegram Mini App requirement, migrate to the same `@nau/auth` + middleware pattern as `app` and `flownau`

### 11.6 `whatsnau` — completely out of platform SSO

`whatsnau` is a standalone Express + React app with its own email/password auth. It has no `@nau/auth` dependency, no `nau_at`/`nau_rt` cookies, no reference to `accounts.9nau.com`.

- [ ] When `whatsnau` re-enters scope (post-v1), the auth rewrite should be its first task: replace standalone auth with `@nau/auth` + cookie pattern; remove `apps/whatsnau/packages/backend/src/api/auth.controller.ts` standalone implementation
- [ ] `whatsnau/packages/backend/src/core/authMiddleware.ts` — confirm it is not reachable from any other service; mark as isolated

### 11.7 Environment variable naming and defaults

**Finding:** `ACCOUNTS_URL` and `APP_URL` are referenced inconsistently — sometimes as `NEXT_PUBLIC_*`, sometimes as server-only, sometimes both with `??` fallback between them:

| App | Variable | Pattern |
|---|---|---|
| `app/src/middleware.ts` | `ACCOUNTS_URL ?? NEXT_PUBLIC_ACCOUNTS_URL` | Server + client fallback |
| `flownau/src/middleware.ts` | `NEXT_PUBLIC_ACCOUNTS_URL` only | Client-only (wrong for middleware — runs on server) |
| `flownau/src/lib/auth.ts` | `NEXT_PUBLIC_ACCOUNTS_URL`, `NEXT_PUBLIC_APP_URL` | Client-only |
| `accounts/src/middleware.ts` | `NEXT_PUBLIC_APP_URL` | Client-only (runs on server) |
| `nauthenticity` callback controller | `process.env['ACCOUNTS_URL']`, `process.env['DASHBOARD_URL']` | Server-only, no `NEXT_PUBLIC_` prefix |
| `zazu-dashboard` | `NEXT_PUBLIC_ACCOUNTS_URL`, `NEXT_PUBLIC_DASHBOARD_URL` | Client-exposed |

Next.js middleware runs on the Edge/Node server — `NEXT_PUBLIC_*` variables are embedded at build time and work, but they expose values to the client unnecessarily. Mixing `ACCOUNTS_URL` and `NEXT_PUBLIC_ACCOUNTS_URL` with fallback chains means a missing server-only var silently falls back to a build-time value.

**Target standard:** Define canonical env var names in `packages/config/`; each app's `env-validation.ts` (or equivalent) asserts presence at startup; Next.js middleware uses server-only vars (`ACCOUNTS_URL`, not `NEXT_PUBLIC_ACCOUNTS_URL`).

- [ ] Audit every `ACCOUNTS_URL` / `APP_URL` / `DASHBOARD_URL` reference across all apps — inventory file at `docs/env-vars.md` (or add to §5.5 checklist)
- [ ] Standardise: server-side code uses `ACCOUNTS_URL`; only code that runs in the browser uses `NEXT_PUBLIC_ACCOUNTS_URL`
- [ ] `flownau/src/middleware.ts` — change `NEXT_PUBLIC_ACCOUNTS_URL` to `ACCOUNTS_URL` (middleware is server-side)
- [ ] `accounts/src/middleware.ts` — same fix
- [ ] Ensure all apps fail fast at startup if `ACCOUNTS_URL` is missing (add to env-validation)

---

## 12. UI/UX ecosystem standardisation

> **Purpose:** The naŭ platform is a suite of apps that share a single SSO identity, a single domain family (*.9nau.com), and a single user. Users will switch between apps (flownau → app → zazu-dashboard) and they must feel like they are within one product, not five separate projects. Today each app is a stylistic island. This section defines the convergence target and the steps to reach it.
>
> **Scope:** Web apps only — `app`, `flownau`, `accounts`, `nauthenticity/dashboard`, `zazu-dashboard`. `whatsnau` is deferred (v1 out of scope). `mobile` follows its own platform conventions (React Native) and is addressed separately in §12.9.

---

### 12.1 Current state — per-app snapshot

| App | Accent color | Background | Fonts | CSS approach | Shared pkg |
|---|---|---|---|---|---|
| `app` | Violet `#7c3aed` | `#000` + dark mode | Inter | Tailwind + `@9nau/ui` | ✅ `@9nau/ui` |
| `flownau` | Violet `#7c3aed` | `#0d0d0d` | Inter + **Outfit** | Tailwind + bespoke CSS layer | ❌ |
| `accounts` | Violet `#7c3aed` | `#000` | Inter | Tailwind + `@9nau/ui` | ✅ `@9nau/ui` |
| `nauthenticity` | GitHub blue `#58a6ff` | `#0f1115` | Inter (system) | **Plain CSS** (688-line `index.css`), no Tailwind | ❌ |
| `zazu-dashboard` | Neon green `#00ff88` + cyan `#00d4ff` | `#0a0e12` | **Outfit** only | **Plain CSS** (286-line `globals.css`), no Tailwind | ❌ |
| `whatsnau` | Purple `#7c7cff` + magenta `#d946ef` | `#0c0a15` | Inter | Tailwind + bespoke CSS vars | ❌ |

**Findings summary:**
- 3 completely different accent palettes (`app`/`flownau`/`accounts` ≈ violet family; `nauthenticity` = blue; `zazu` = neon green)
- 2 apps use the shared `@9nau/ui` package; 4 apps reinvent their own components
- 2 apps (`nauthenticity`, `zazu-dashboard`) use plain CSS with no Tailwind
- Font stack diverges: most apps use Inter; `flownau` and `zazu-dashboard` add Outfit for headings; `nauthenticity` uses system Inter
- `zazu-dashboard` HTML `lang` attribute is `"es"` (Spanish) — inconsistent with a multi-language platform
- `nauthenticity` dashboard still uses React Router v6 + Vite (not Next.js) — different routing paradigm from the rest
- `whatsnau` frontend is a tab-based SPA with no routing at all

---

### 12.2 Design token standard

A single `packages/nau-tokens/` (or extend `packages/nau-ui/`) should define all shared design decisions. Every app imports these tokens; no app defines its own competing set.

**Required tokens:**

```
Colors
  --nau-bg:          #08090a    (all-app dark background)
  --nau-surface:     #111318    (card/panel surface)
  --nau-border:      rgba(255,255,255,0.08)
  --nau-accent:      #7c3aed    (primary violet — ecosystem identity colour)
  --nau-accent-dim:  #6d28d9
  --nau-text:        #f4f4f5
  --nau-text-dim:    #a1a1aa
  --nau-success:     #22c55e
  --nau-error:       #ef4444
  --nau-warning:     #f59e0b

Typography
  --nau-font-sans:   'Inter', system-ui, sans-serif
  --nau-font-display:'Outfit', 'Inter', sans-serif   (headings only)
  --nau-font-mono:   'JetBrains Mono', 'Fira Code', monospace

Radii / spacing — via Tailwind's default scale (no custom values)
```

Each app-specific accent colour (`#00ff88` in zazu, `#58a6ff` in nauthenticity) is replaced with `--nau-accent`. App-level theming, if any, is done through a single per-app CSS class override (`[data-app="zazu"]`) — not by redefining the base token set.

- [ ] Create `packages/nau-tokens/tokens.css` (or `tokens.ts` for JS consumers) with the canonical token set
- [ ] Extend `packages/nau-ui/` to re-export tokens and ensure every component uses them
- [ ] All apps import `@nau/tokens` (or equivalent) in their root CSS / `globals.css`; no app defines competing `--primary`, `--bg-*`, etc. vars
- [ ] Replace `nauthenticity` dashboard's `--accent: #58a6ff` and `--primary: #58a6ff` with `--nau-accent`
- [ ] Replace `zazu-dashboard`'s `--primary: #00ff88` with `--nau-accent`
- [ ] Align font loading: all Next.js apps load Inter + Outfit via `next/font/google` in their root layout; `nauthenticity` Vite app loads via `<link>` in `index.html`

### 12.3 Shared component library — `@9nau/ui` extension

`@9nau/ui` already exports `Button`, `Card`, `Input`, `TelegramLinkBanner`. It needs to grow into the definitive component library for all web apps.

**Components that need to be promoted to `@9nau/ui`:**

| Component | Currently duplicated in |
|---|---|
| Sidebar (collapsible, icon + label) | `app`, `flownau`, `nauthenticity`, `whatsnau`, `zazu-dashboard` — all custom |
| TopBar / Header (logo, user avatar, nav links) | `app`, `flownau`, `nauthenticity` — all custom |
| `PageShell` (Sidebar + Header + `<main>`) | every app — each owns its own layout wrapper |
| `EmptyState` (icon + title + description + CTA) | duplicated ad hoc across apps |
| `LoadingSpinner` / `FullPageLoader` | duplicated in every app |
| `Badge` / `Tag` | duplicated |
| `Avatar` | duplicated |
| `Toast` / notification primitive | `flownau` uses Sonner; others ad hoc |
| `Modal` / `Dialog` wrapper | each app wraps Radix Dialog independently |

**Actions:**
- [ ] Audit `packages/nau-ui/src/components/` — document what exists
- [ ] Add `Sidebar`, `PageShell`, `TopBar`, `EmptyState`, `LoadingSpinner`, `Avatar`, `Badge` to `@9nau/ui`
- [ ] All apps replace their local equivalents with the shared components
- [ ] Standardise on **Sonner** for toasts platform-wide (already used in flownau; extend to others)
- [ ] Standardise on **Radix UI** primitives underneath shared components; no app should install Radix directly for components covered by `@9nau/ui`

### 12.4 Tailwind configuration — single shared preset

Each app that uses Tailwind currently has its own `tailwind.config.ts` with varying content arrays and partial theme extensions.

**Target:** A single `packages/nau-ui/tailwind.preset.ts` that every app's `tailwind.config.ts` extends:

```ts
// apps/*/tailwind.config.ts
import { nauPreset } from '@9nau/ui/tailwind-preset'
export default { presets: [nauPreset], content: ['./src/**/*.{ts,tsx}', ...] }
```

The preset defines: colors (mapped to CSS vars), borderRadius, fontFamily, animation keyframes, and the `tailwindcss-animate` plugin.

- [ ] Create `packages/nau-ui/tailwind.preset.ts`
- [ ] Update all Next.js app Tailwind configs to extend the preset
- [ ] Migrate `nauthenticity` and `zazu-dashboard` from plain CSS to Tailwind (or at minimum consume the token CSS file)
- [ ] Remove any app-level Tailwind theme extensions that duplicate the preset

### 12.5 App shell / layout standard

Every authenticated app should present the same shell:

```
┌─────────────────────────────────────────────────┐
│  TopBar: [9naŭ logo] [App name] ... [User menu] │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │  <main> (scrollable page content)    │
│ (icons + │                                      │
│ labels)  │                                      │
│ collapsible to icon-only on narrow viewports    │
└──────────┴──────────────────────────────────────┘
```

- **TopBar** always shows: the 9naŭ ecosystem logo (links to `app.9nau.com`), the current app name, and a user avatar/menu (links to `accounts.9nau.com` for profile/logout)
- **Sidebar** shows app-specific nav items; same visual treatment (icon + label, active state, collapse behaviour) across all apps
- **No app should have a second navigation layer** (tabs inside tabs, sidebar inside sidebar)

Current deviations:
- `nauthenticity` dashboard has a 260px fixed sidebar + no top bar — collapsibility not implemented
- `zazu-dashboard` has a three-column grid (sidebar | chat | settings) — exceptional layout for the bot console; document as intentional deviation
- `whatsnau` uses tab buttons inside a sidebar — needs refactoring to sidebar nav items
- `flownau` sidebar is 80px icon-only by default, expands to 288px — closest to the standard

- [ ] Implement `PageShell` in `@9nau/ui` with the canonical sidebar + topbar structure
- [ ] Migrate `app` to use `PageShell` (already close; mainly adding the ecosystem topbar)
- [ ] Migrate `flownau` to use `PageShell`
- [ ] Migrate `nauthenticity` dashboard to use `PageShell` (requires Tailwind migration first)
- [ ] `zazu-dashboard` — document its three-column layout as the intentional exception for the bot console UX; still adopt `--nau-*` tokens and the shared topbar

### 12.6 Landing page at `/` — standard pattern

Every app must follow the same pattern at its root URL:

| Condition | Behaviour |
|---|---|
| User is **not** authenticated | Show a **public landing/marketing page** for that app |
| User is **authenticated** | Redirect to the app's authenticated home (e.g. `/home`, `/dashboard`) |

**Current state:**

| App | `/` behaviour | Compliant? |
|---|---|---|
| `app` | Public marketing landing → redirect to `/home` if authed | ✅ |
| `flownau` | Public marketing landing → redirect to `/dashboard` if authed | ✅ |
| `accounts` | Immediately redirects to `/login` | ❌ — no landing page |
| `nauthenticity` | React Router redirects `/` → `/workspaces` (auth required) | ❌ — no public landing |
| `zazu-dashboard` | Auth-protected, no public landing — redirects to `/login` | ❌ — no public landing |
| `whatsnau` | SPA loads dashboard directly, auth check in App.tsx | ❌ — no landing page |

- [ ] `accounts` — replace the `/` → `/login` redirect with a public landing page for the accounts/identity product; login/register remain at `/login`, `/register`
- [ ] `nauthenticity` dashboard — add a public landing page at `/`; the authenticated workspace panel moves to `/workspaces` (already correct) with a proper auth gate
- [ ] `zazu-dashboard` — add a public landing at `/`; the bot console panel remains auth-protected at `/dashboard` or `/console`
- [ ] `whatsnau` — deferred (v1 out of scope); mark landing page as a v2 requirement when SSO is added

### 12.7 Authenticated home route — naming standard

The authenticated "home" of each app must be at a consistent, predictable path.

**Standard:** `/dashboard` for tool/product apps; `/home` for the main personal hub (`app`).

| App | Current auth home | Compliant? |
|---|---|---|
| `app` | `/home` | ✅ — intentional; it is the personal hub, not a tool |
| `flownau` | `/dashboard` | ✅ |
| `accounts` | `/login` (no auth home) | N/A — accounts is a pass-through, not a panel |
| `nauthenticity` | `/workspaces` | ❌ — should be `/dashboard` |
| `zazu-dashboard` | `/` (no separation from landing) | ❌ — mix of landing + panel |
| `whatsnau` | SPA root with tab state | ❌ — deferred |

- [ ] `nauthenticity` — rename `/workspaces` → `/dashboard` as the authenticated root; update React Router config, sidebar links, and any hardcoded redirects
- [ ] `zazu-dashboard` — introduce `/dashboard` as the authenticated panel route; `/` becomes the public landing

### 12.8 UX flows — login, logout, session expiry

All apps must handle these flows identically. No app should implement its own loading screen, error message copy, or redirect logic for auth state changes.

**Standard flows:**

1. **Unauthenticated access to protected route** → `302` to `accounts.9nau.com/login?redirect_uri=<destination>` (handled by Next.js middleware or equivalent; see §11)
2. **Successful login** → accounts sets cookies, redirects to `redirect_uri` — user lands directly on the page they wanted
3. **Expired session (access token)** → middleware silently refreshes with `nau_rt`; user sees no interruption
4. **Expired session (refresh token dead)** → full redirect to login with current URL as `redirect_uri`
5. **Logout** → POST to `api/auth/logout`, cookies cleared, redirect to `accounts.9nau.com/login` (not to the app root)
6. **Loading states** — while session check is in progress, show the `@9nau/ui` `FullPageLoader` spinner (not each app's custom spinner)

**Current deviations:**
- `zazu-dashboard` logout uses NextAuth `signOut()` which may not clear the platform `nau_at`/`nau_rt` cookies
- `nauthenticity` Vite SPA has its own `clearToken()` function that redirects to `/auth/logout` on the NestJS server — only clears platform cookies, does not hit the API `/auth/logout` to revoke the refresh token in the DB
- `flownau` has no explicit logout UI found in the sidebar — logout flow unclear
- Session-expiry UX is undefined in `nauthenticity` and `zazu-dashboard` (no graceful redirect to re-authenticate)

- [ ] Define and document the 6 standard UX flows above as the canonical contract
- [ ] `nauthenticity` Vite SPA logout — `clearToken()` must also call `POST api.9nau.com/auth/logout` to revoke the refresh token, then clear cookies, then redirect
- [ ] `zazu-dashboard` logout — ensure `signOut()` also invalidates the platform refresh token at the API
- [ ] All apps must show a consistent "session expired" screen/toast before redirecting (use `@9nau/ui` toast, not custom UI)
- [ ] Add explicit logout button/menu item to every app's sidebar/topbar using the shared flow

### 12.9 Mobile app — platform consistency (scoped)

The `mobile` app uses React Native (Expo) and cannot share CSS/Tailwind components. However it must maintain visual coherence with the web ecosystem.

- [ ] Audit `COLORS` constant in mobile — ensure `primary`/`accent` values match `--nau-accent` (`#7c3aed` or its hex equivalent for RN)
- [ ] Typography: confirm the mobile app loads Inter via Expo Google Fonts; add Outfit for display text if headings are used
- [ ] Mobile landing/onboarding screen — define the pattern (currently a feed view on launch with no public landing concept; intentional for a mobile app — document as such)
- [ ] Ensure the mobile share-intent flow surfaces the same error messages and loading states as the web apps (copy consistency)

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
| `zazu-dashboard/auth.ts`: `AUTH_SECRET ?? "changeme"` fallback | High | ❌ Open — throws required (see §11.3) |
| SSO redirect parameter split (`continue` vs `redirect_uri`) across 5 apps | Medium | ❌ Open — standardise on `redirect_uri` (see §11.1) |
| Redundant `/auth/callback` pages in flownau and nauthenticity | Low | ❌ Open — remove for Next.js apps (see §11.2) |
| `flownau/src/middleware.ts` uses `NEXT_PUBLIC_ACCOUNTS_URL` in server-side code | Low | ❌ Open — change to `ACCOUNTS_URL` (see §11.7) |
| `zazu-dashboard` dual-session problem (NextAuth + platform cookie) | Medium | ❌ Open — session sync required (see §11.5) |
| Design token fragmentation — 3 accent palettes, 4 bespoke CSS systems | Medium | ❌ Open — consolidate into `packages/nau-tokens/` (see §12.2) |
| `@9nau/ui` only used by 2/6 apps; 4 apps duplicate sidebar/layout/components | Medium | ❌ Open — promote shared components (see §12.3) |
| `nauthenticity` and `zazu-dashboard` use plain CSS, no Tailwind | Low | ❌ Open — migrate to Tailwind + shared preset (see §12.4) |
| `accounts` `/` redirects to `/login` — no public landing page | Low | ❌ Open — add landing (see §12.6) |
| `nauthenticity` has no public landing at `/`; panel has no `/dashboard` prefix | Low | ❌ Open — add landing + rename route (see §12.6, §12.7) |
| `zazu-dashboard` has no public landing; auth panel mixed with root route | Low | ❌ Open — add landing + `/dashboard` route (see §12.6, §12.7) |
| `nauthenticity` SPA logout does not revoke refresh token in API DB | Medium | ❌ Open — call `POST /auth/logout` before clearing cookies (see §12.8) |
| `zazu-dashboard` `lang="es"` on root HTML element | Low | ❌ Open — set to `"en"` or derive from user locale |
