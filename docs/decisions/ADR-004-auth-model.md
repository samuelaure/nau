# ADR-004 — Access + refresh token model with per-service client JWTs

- **Status:** 🟢 Accepted
- **Date:** 2026-04-23

## Context

The pre-refactor auth model had several industry-standard-nonconformant patterns:

1. A single long-lived `nau_token` JWT (30-day access, no refresh flow).
2. A single shared `NAU_SERVICE_KEY` used by every service-to-service call on the platform.
3. Access tokens forwarded via `?token=...` in redirect URLs (visible in browser history, server logs, referers).
4. Login cookie written via `document.cookie` on `accounts.9nau.com` — not HttpOnly, vulnerable to XSS.
5. nauthenticity's `/auth/callback` used `jwt.decode()` (no signature verification).

As the platform prepares for SaaS launch (thousands of tenants, multi-team collaboration, external partner APIs in future), the auth model needs to meet industry standards for security and scalability.

## Decision

Adopt an OAuth2/OIDC-style model adapted for the platform's shape:

### User auth: access + refresh tokens

- **Access token** (`nau_at`): JWT, 15 minutes. Cookie `HttpOnly; Secure; SameSite=Lax; Domain=.9nau.com; Path=/`.
- **Refresh token** (`nau_rt`): opaque 256-bit random, bcrypt-hashed in `Session` table, 30 days. Cookie `HttpOnly; Secure; SameSite=Strict; Domain=.9nau.com; Path=/auth/refresh`.
- **Rotation**: every refresh call issues a new pair and revokes the previous refresh token.
- **Reuse detection**: revoked-refresh-token replay → revoke entire session chain (RFC 6749 §10.4).
- **Server-side mint**: `accounts.9nau.com` uses server actions to proxy login/refresh to `api.9nau.com`; only the server sets `Set-Cookie` headers, never client-side JS.

### Service-to-service: per-service signed JWTs

- 9naŭ API holds a `ServiceClient { id, secretHash, scopes, isActive }` table.
- Each service has its own secret (`<SERVICE>_SERVICE_SECRET` env var).
- Callers sign short-lived (5 min) JWTs with their own secret, claims `{ iss, aud, exp, jti }`.
- Receivers look up the expected secret by `iss`, verify signature.
- Replay protection: `jti` cached in Redis for 10 minutes.
- Rotation: overlap-window supported via `previousSecretHash`.

### Mobile: bearer tokens

- Login returns `{ accessToken, refreshToken }` in JSON. Client stores in secure device storage.
- API calls use `Authorization: Bearer <accessToken>`.

### CSRF: same-site + double-submit

- SameSite cookies (Lax for access, Strict for refresh) as first line.
- Double-submit pattern (`x-nau-csrf` header matching `nau_csrf` cookie) for state-changing browser-originated requests.

### Algorithm: HS256 today, RS256-ready tomorrow

- Shared `AUTH_SECRET` for HS256 during Phase 2.
- `@nau/auth` abstracts the algorithm — swap to RS256 + JWKS endpoint via config change (no app code change).
- Migration plan: [../future/rs256-jwks-migration.md](../future/rs256-jwks-migration.md).

Full specification in [../platform/AUTH.md](../platform/AUTH.md).

## Alternatives considered

### A. Keep single long-lived JWT with no refresh

Simplest to implement. Rejected because:
- Token revocation is impossible without an allowlist/denylist check on every request (defeating JWT's stateless benefit).
- A stolen token is valid for 30 days.
- Industry standard for OAuth2-style auth is short access + rotating refresh.

### B. Opaque bearer tokens end-to-end (no JWT)

All tokens are random strings, every service hits 9naŭ API's `/validate` on each request.

Rejected because:
- Every request incurs a cross-service round trip.
- Doesn't scale as services multiply.
- JWT with short TTL + refresh gives the same security with far better performance.

### C. Third-party IdP (Auth0, Clerk, WorkOS)

Considered as an alternative to building auth in-house.

Rejected for this phase because:
- Platform is pre-launch with its own identity tables already built
- Deep integration with platform concepts (workspaces, brand-scoped permissions) is easier in-house
- Moving to a third-party IdP later is a refactor we can make once user volume justifies
- Cost at scale is non-trivial (Auth0 alone >$2k/month at 10k monthly active users)

Revisit post-launch if operational load justifies the offload.

### D. mTLS for service-to-service

More robust than signed JWTs for inter-service calls.

Rejected for this phase because:
- Requires cert management, rotation, CA infrastructure
- Marginal security benefit over signed JWTs at current trust boundaries (all services inside Docker network)
- Can be layered on later without changing app code (Traefik can terminate mTLS transparently)

## Consequences

### Positive

- **RFC-compliant** OAuth2-style flow — familiar to any backend engineer.
- **Short access tokens** limit blast radius of compromise.
- **Revocation works** via refresh-token denylist in `Session` table.
- **Per-service secrets** eliminate single-point-of-failure of the shared key.
- **Audit trail**: every service call's `iss` is logged — "who called me" is always answerable.
- **Clean path to RS256**: abstracted in `@nau/auth`.
- **Mobile-friendly**: same model, bearer headers replace cookies.

### Negative

- **Refresh flow adds client complexity** — mitigated by `@nau/sdk` implementing it transparently.
- **Per-service secret management** adds ops burden — mitigated by documenting clearly in [AUTH.md §4](../platform/AUTH.md#service-to-service-auth) and providing rotation scripts.
- **JWT size** (~300 bytes) larger than cookie opaque tokens. Acceptable.

### Security properties gained

| Attack | Pre-refactor | Post-refactor |
|---|---|---|
| XSS → token exfiltration | Succeeds (client-side cookie) | Fails (HttpOnly) |
| CSRF → unauthorized state change | Succeeds (no CSRF guard) | Fails (double-submit + SameSite) |
| Stolen access token | Valid for 30 days | Valid for 15 minutes |
| Stolen refresh token | N/A (didn't exist) | Detectable via reuse; triggers session revoke |
| Service key leak | All service paths compromised | One service compromised; isolated via per-caller secret |
| Tokens in logs/referers | Yes (URL forwarding) | No |
| Signature bypass (nauthenticity) | Yes (`jwt.decode`) | No (`jwtVerify` via `@nau/auth`) |

## References

- [../platform/AUTH.md](../platform/AUTH.md) — full specification
- [../platform/ENTITIES.md](../platform/ENTITIES.md) — `Session`, `ServiceClient`, `AuthLinkToken` schemas
- [../packages/auth.md](../packages/auth.md) — `@nau/auth` package docs
- [../future/rs256-jwks-migration.md](../future/rs256-jwks-migration.md) — future asymmetric upgrade

## Implementation (Phases 1–7 — completed)

### `@nau/auth` package (`packages/auth/src/`)

```typescript
// Core exports
signServiceToken({ iss, aud, secret }): Promise<string>   // signs 60s JWT
verifyServiceToken(token, secret): Promise<JWTPayload>    // throws AuthError on failure
extractBearerToken(authHeader): string | undefined
buildAccessTokenCookie(token, env): string
buildRefreshTokenCookie(token, env): string

// NestJS guards (packages/auth/src/nest/)
JwtAuthGuard     // verifies nau_at cookie or Authorization Bearer
ServiceAuthGuard // verifies service JWT via verifyServiceToken
```

### Service-to-service auth — adopted across all services

| Caller | Called | Method |
|---|---|---|
| zazu-bot | 9nau-api | `buildServiceHeaders('9nau-api')` → `signServiceToken({ iss: 'zazu-bot', aud: '9nau-api', secret })` |
| zazu-dashboard | 9nau-api | `serviceHeaders('9nau-api')` in `actions.ts` |
| zazu-dashboard | nauthenticity | `serviceHeaders('nauthenticity')` in `actions.ts` |
| flownau | nauthenticity | `signServiceToken({ iss: 'flownau', aud: 'nauthenticity', secret })` in cron route |
| flownau | 9nau-api | via `@nau/sdk` → `createNauServiceClient()` |
| 9nau-api | nauthenticity | `signServiceToken({ iss: '9nau-api', aud: 'nauthenticity', secret })` in `NauthenticityService` |

### Inbound validation — where each service uses what

- `nauthenticity`: NestJS `ServiceAuthGuard` on `/_service/*` routes
- `flownau`: `validateServiceToken(req)` (`src/modules/shared/nau-auth.ts`)
- `zazu-bot` (Express): `requireServiceAuth` middleware (`src/lib/service-auth.ts`)
- `9nau-api`: `ServiceAuthGuard` on `/_service/*` routes
