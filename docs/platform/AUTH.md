# naŭ Platform — Authentication & Authorization

> The auth model for the entire platform. This doc is the single source of truth. Any auth code in any service must conform to what's written here.

---

## 1. Overview

Three auth contexts, one model:

| Context | Caller | Mechanism |
|---|---|---|
| **User auth** | Browser / mobile client | Access + refresh tokens in HttpOnly cookies (web) or in response body (mobile), signed by 9naŭ API |
| **Service-to-service** | One platform service calling another | Short-lived JWT signed by caller with per-service secret |
| **Cron** | Cloud Scheduler / Vercel Cron hitting flownaŭ | `Authorization: Bearer <CRON_SECRET>` |

All three verify through the shared `@nau/auth` package. Algorithm (HS256 today, RS256 + JWKS tomorrow) is a config knob, not a code change.

---

## 2. User auth — SSO across `.9nau.com`

### 2.1. The players

- **`accounts.9nau.com`** — the only app that renders login / register forms. Acts as the OIDC-style identity provider UI.
- **`api.9nau.com`** — the token issuer. Validates credentials, mints JWTs, stores refresh sessions.
- **Every other subdomain** (`flownau`, `nauthenticity`, `app`, `zazu`) — JWT verifiers. Never mints tokens, never collects passwords.

### 2.2. Tokens

| Token | Format | Lifetime | Where stored | Rotated on |
|---|---|---|---|---|
| **Access token** (`nau_at`) | JWT, HS256 initially | 15 minutes | `HttpOnly; Secure; SameSite=Lax; Domain=.9nau.com; Path=/` cookie | every 15 min via refresh |
| **Refresh token** (`nau_rt`) | Opaque 256-bit random string, bcrypt-hashed in `Session` table | 30 days | `HttpOnly; Secure; SameSite=Strict; Domain=.9nau.com; Path=/auth/refresh` cookie | every refresh (rotation) |

Access token JWT claims:

```json
{
  "sub": "user_cuid",
  "email": "user@example.com",
  "iss": "api.9nau.com",
  "aud": "nau-platform",
  "iat": 1713888000,
  "exp": 1713888900
}
```

### 2.3. Login flow

```
1. Browser → accounts.9nau.com/login
2. User submits form to accounts.9nau.com server action
3. Server action → POST api.9nau.com/auth/login  { email, password }
4. api.9nau.com:
     - verify password (bcrypt)
     - generate accessToken (JWT, 15m)
     - generate refreshToken (random, 30d)
     - INSERT Session { userId, refreshTokenHash: bcrypt(refreshToken), expiresAt }
     - return { accessToken, refreshToken } to the server action (over nau-network)
5. accounts server action responds with:
     Set-Cookie: nau_at=<accessToken>;  HttpOnly; Secure; Domain=.9nau.com; SameSite=Lax;    Path=/;              Max-Age=900
     Set-Cookie: nau_rt=<refreshToken>; HttpOnly; Secure; Domain=.9nau.com; SameSite=Strict; Path=/auth/refresh;  Max-Age=2592000
     302 → <continue>   (NO token in URL)
6. Browser follows redirect — cookies travel to all .9nau.com subdomains automatically.
```

### 2.4. Request flow (any consumer app)

```
1. Browser → flownau.9nau.com/dashboard
2. Browser sends nau_at cookie (travels on .9nau.com)
3. flownaŭ middleware (via @nau/auth):
     jwtVerify(nau_at, config.secret)
     if valid → attach { userId, email } to request
     if invalid/missing → continue to step 5
4. Request handled.
5. If 401: client-side auto-refresh triggered (see 2.5).
```

### 2.5. Refresh flow

```
1. Consumer app's client-side middleware detects 401 on an authenticated request
2. → POST accounts.9nau.com/auth/refresh   (cookie nau_rt sent automatically; Path=/auth/refresh)
3. accounts server action → POST api.9nau.com/auth/refresh  { refreshToken: cookie.nau_rt }
4. api.9nau.com:
     - lookup Session WHERE refreshTokenHash = bcrypt_match(refreshToken) AND revokedAt IS NULL AND expiresAt > now()
     - if not found → 401 (client must re-login)
     - MARK current Session.revokedAt = now(), replacedBySessionId = newId
     - INSERT new Session (rotation)
     - mint new access + refresh tokens
     - return both
5. accounts responds with new Set-Cookie headers for nau_at and nau_rt
6. Original request retried with new nau_at
```

**Reuse detection (RFC 6749 §10.4):** if a refresh token is submitted that's already `revokedAt` (an attacker replayed a stolen refresh), **revoke the entire session chain** (walk `replacedBySessionId` forward, revoke all). Force the user to re-login everywhere.

### 2.6. Logout flow

```
POST accounts.9nau.com/auth/logout
  → server action calls api.9nau.com/auth/logout { refreshToken }
  → api.9nau.com marks Session.revokedAt
  → response clears both cookies:
      Set-Cookie: nau_at=; Max-Age=0; Domain=.9nau.com
      Set-Cookie: nau_rt=; Max-Age=0; Domain=.9nau.com; Path=/auth/refresh
```

### 2.7. Mobile auth (9naŭ mobile)

Cookies aren't practical for mobile. Instead:

- Login returns `{ accessToken, refreshToken }` in JSON response.
- Client stores in secure device storage (Keychain / EncryptedSharedPreferences).
- API calls use `Authorization: Bearer <accessToken>`.
- Refresh calls `POST /auth/refresh` with refreshToken in body.

---

## 3. CSRF protection

Cookie-based auth on browser clients is vulnerable to CSRF without mitigation.

### 3.1. Same-site cookies (first line of defense)

- Access token: `SameSite=Lax` — blocks cross-site POST/PUT/DELETE/PATCH by default, allows top-level GET navigation.
- Refresh token: `SameSite=Strict` — never sent on cross-site requests at all. Scoped to `Path=/auth/refresh`.

### 3.2. Double-submit cookie (second line of defense)

For all state-changing browser-originated requests (POST/PATCH/DELETE from a `.9nau.com` page):

```
1. Server reads the user's nau_at. If valid, and a nau_csrf cookie doesn't exist:
     Set-Cookie: nau_csrf=<random>; SameSite=Strict; Domain=.9nau.com; Max-Age=3600
   (Note: NOT HttpOnly — the client-side code must be able to read it.)

2. Client-side code (provided by @nau/sdk) reads nau_csrf cookie and sends:
     x-nau-csrf: <random>
   header on every state-changing request.

3. Server (via @nau/auth CSRF middleware) checks:
     request.headers['x-nau-csrf'] === request.cookies['nau_csrf']
   → reject if mismatch.
```

CSRF protection is applied automatically by `@nau/auth` middleware when it detects a cookie-authenticated request.

### 3.3. Service-to-service and mobile are exempt

- Service tokens travel via `Authorization: Bearer`, not cookies → no CSRF vector.
- Mobile tokens stored in secure device storage → no CSRF vector.

---

## 4. Service-to-service auth

### 4.1. Problem with the current `NAU_SERVICE_KEY`

Single shared secret across all services. If it leaks from one service, all service-to-service calls are compromised. No audit trail of which service called what.

### 4.2. New model: per-service JWTs

Each caller service has its own credentials stored in 9naŭ API's `ServiceClient` table:

```
ServiceClient { id: "flownau",        secretHash: <bcrypt> }
ServiceClient { id: "nauthenticity",  secretHash: <bcrypt> }
ServiceClient { id: "zazu",           secretHash: <bcrypt> }
ServiceClient { id: "9nau-api",       secretHash: <bcrypt> }  // api can call itself (rare)
```

Each service stores its own secret in an env var:

```
FLOWNAU_SERVICE_SECRET=<plaintext-32-byte-hex>
NAUTHENTICITY_SERVICE_SECRET=<plaintext-32-byte-hex>
ZAZU_SERVICE_SECRET=<plaintext-32-byte-hex>
```

### 4.3. Making a service call

Caller (e.g. flownaŭ calling 9naŭ API):

```ts
import { createServiceToken } from '@nau/auth'

const token = createServiceToken({
  iss: 'flownau',
  aud: '9nau-api',
  secret: process.env.FLOWNAU_SERVICE_SECRET,
  ttl: 300,  // 5 min
})

const res = await fetch('https://api.9nau.com/brands/:id/prompts', {
  headers: { Authorization: `Bearer ${token}` }
})
```

Token claims:

```json
{
  "iss": "flownau",
  "aud": "9nau-api",
  "sub": "service",
  "exp": 1713888300,
  "iat": 1713888000,
  "jti": "uuid-for-replay-prevention"
}
```

### 4.4. Receiving a service call

Receiver (9naŭ API `ServiceAuthGuard`):

```ts
1. Parse Bearer token from Authorization header.
2. Decode header to get `iss` claim.
3. Lookup ServiceClient by iss. If not found or !isActive → 401.
4. Fetch secretHash; verify token signature using plaintext secret (from env lookup keyed by iss).
   - In dev/staging: keep a map { iss → secret } in env.
   - In prod: each receiver service stores expected secrets for callers it trusts. (Or: look up plaintext in its own env by convention: process.env[`SERVICE_SECRET_${iss.toUpperCase()}`].)
5. Verify aud === own service name.
6. Verify exp > now.
7. Verify jti not in recent-replay cache (Redis, 10min TTL).
8. If all pass → attach { service: iss } to request and proceed.
```

### 4.5. Rotation

To rotate a service's secret:

```
1. Generate new secret.
2. INSERT new ServiceClient row with same id but new secretHash — KEEP the old one temporarily.
   (Or support a `previousSecretHash` column for overlap window.)
3. Deploy the new secret to the caller service first.
4. Verify calls are succeeding with the new secret.
5. Remove the old secretHash.
```

No downtime. Scales to any number of callers.

---

## 5. Cron auth

Cron routes (in flownaŭ: `/api/cron/*`) are hit by external schedulers, not by any user or platform service.

```
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET` is a single secret shared between the scheduler and flownaŭ. Industry-standard for this class of job. Rotated annually.

Validation via `@nau/auth/validateCronSecret()` — single helper, same across any app that has cron routes.

---

## 6. Authorization model (permissions)

Identity (authn) answers "who are you?" Authorization (authz) answers "are you allowed?".

### 6.1. Scopes, not roles, at the token level

Access tokens carry **scopes** (OAuth-style), not role names. `@nau/auth` resolves scopes at login based on the user's `WorkspaceMember` rows:

```ts
// Example scopes in access token
scope: "workspace:cmo4...:owner workspace:cmo5...:admin brand:cmb7...:write"
```

### 6.2. Enforcement

Each API route declares required scopes. `@nau/auth`'s `requireAuth()` middleware parses scopes, and the route handler checks:

```ts
@requireAuth()
@Controller('/workspaces/:id/brands')
class BrandsController {
  @Delete(':brandId')
  @requireScope('workspace:{{id}}:owner')   // only workspace owners can delete brands
  deleteBrand(...) { ... }
}
```

### 6.3. Role → scope mapping

| WorkspaceRole | Scopes granted for that workspace |
|---|---|
| `OWNER` | `workspace:<id>:owner workspace:<id>:admin workspace:<id>:member brand:<all brandIds>:write brand:<all brandIds>:read` |
| `ADMIN` | `workspace:<id>:admin workspace:<id>:member brand:<all brandIds>:write brand:<all brandIds>:read` |
| `MEMBER` | `workspace:<id>:member brand:<all brandIds>:read` |

Members can read brands and use the platform; only admins/owners can modify brands. Only owners can delete workspace or change ownership.

### 6.4. Brand-level membership (future)

Currently permissions are workspace-scoped. For SaaS teams where different people manage different brands within a workspace, a future `BrandMember` table is documented in [../future/brand-collaboration.md](../future/brand-collaboration.md).

---

## 7. The `@nau/auth` package

Single shared library, used by every service.

```ts
// Token operations
createAccessToken(payload, config)
createRefreshToken()         // opaque, 256-bit
hashRefreshToken(token)      // bcrypt
verifyUserToken(token, config)
createServiceToken({ iss, aud, secret, ttl })
verifyServiceToken(token, { expectedAud, getSecretByIssuer })

// Middleware factories (framework-specific exports)
// - @nau/auth/nestjs: JwtAuthGuard, ServiceAuthGuard, CsrfGuard
// - @nau/auth/next: requireAuth(), requireService(), csrfMiddleware()

// Cron
validateCronSecret(request)
```

The package is algorithm-agnostic. Today it uses HS256 via `jose`. To move to RS256:

1. Deploy new `9nau-api` version that signs with private key + exposes JWKS at `/.well-known/jwks.json`.
2. Bump `@nau/auth` version that verifies via JWKS (with fallback to HS256 during overlap).
3. Rolling-update all consumer services.
4. Remove HS256 fallback.

No application code changes. See [../future/rs256-jwks-migration.md](../future/rs256-jwks-migration.md).

---

## 8. Security principles

1. **Never log tokens.** Access, refresh, service, CSRF — all redacted in logs.
2. **Never pass tokens in URLs.** No `?token=` query params. Ever.
3. **Never store refresh tokens in plaintext.** Only bcrypt hashes in DB.
4. **HttpOnly + Secure + SameSite on every auth cookie.** No exceptions.
5. **Short-lived access tokens.** 15 minutes. The refresh mechanism handles UX.
6. **One-time refresh tokens.** Rotated on every use. Reuse → revoke chain.
7. **Service secrets are per-caller.** No shared `NAU_SERVICE_KEY` once Phase 2 completes.
8. **CSRF guards on every state-changing cookie-authenticated route.** Enforced by `@nau/auth` middleware.
9. **Rate limit on `/auth/login` and `/auth/refresh`.** 10 attempts per IP per 15 min.
10. **Audit log every token event** (issue, refresh, revoke, service call) in `AuthAuditLog` (future — see [observability.md](../future/observability.md)).

---

## 9. Migration from the previous model (historical)

For reference — not active practice.

| Old | New |
|---|---|
| `nau_token` cookie (30-day access-only JWT) | `nau_at` (15m access) + `nau_rt` (30d refresh) |
| Single `NAU_SERVICE_KEY` for all service calls | Per-service `ServiceClient` entries with per-caller secrets |
| Tokens forwarded via `?token=...` in redirect URLs | Cookies on `.9nau.com` only, no URL tokens |
| `jwt.decode()` (signature NOT verified) in nauthenticity | `jwtVerify()` via `@nau/auth`, algorithm-agnostic |
| `document.cookie` write on `accounts.9nau.com` login | Server-side `Set-Cookie` with HttpOnly from accounts server action |

---

## 10. Related docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — where auth sits in the bigger picture
- [API-CONTRACT.md](API-CONTRACT.md) — auth requirements per endpoint
- [ENTITIES.md](ENTITIES.md) — User, Session, ServiceClient schemas
- [../packages/auth.md](../packages/auth.md) — `@nau/auth` package reference
- [../decisions/ADR-004-auth-model.md](../decisions/ADR-004-auth-model.md) — why this model
- [../future/rs256-jwks-migration.md](../future/rs256-jwks-migration.md) — future asymmetric JWT upgrade
