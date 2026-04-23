# Package — @nau/auth

- **Location:** `packages/auth`
- **Consumers:** 9naŭ API, flownaŭ, nauthenticity, zazu-bot, zazu-dashboard, accounts

---

## Purpose

Single abstraction over JWT verification, cookie parsing, and guard decorators. Prevents any service from rolling its own token logic.

---

## Exports

### `verifyAccessToken(token: string): Promise<AccessTokenPayload>`

Verifies `nau_at` JWT signature and expiry. Throws on failure. Algorithm: HS256 today, config-switchable to RS256.

```ts
interface AccessTokenPayload {
  sub: string;          // userId
  workspaceId: string;
  role: WorkspaceRole;
  iat: number;
  exp: number;
}
```

### `verifyServiceToken(token: string): Promise<ServiceTokenPayload>`

Verifies service-to-service JWT signed with per-service secret.

```ts
interface ServiceTokenPayload {
  iss: string;   // serviceClient.slug (e.g. "flownau")
  aud: string;   // target service slug
  iat: number;
  exp: number;
}
```

### `signServiceToken(secret: string, payload: Omit<ServiceTokenPayload, 'iat' | 'exp'>): Promise<string>`

Issues a short-lived (60s) service JWT. Used by service callers before outbound HTTP.

### NestJS guards

- `JwtAuthGuard` — validates `nau_at` from cookie or `Authorization: Bearer` header, attaches user to request.
- `ServiceAuthGuard` — validates service JWT, attaches caller service identity.

### Next.js helpers

- `getSession(request: NextRequest): Promise<AccessTokenPayload | null>` — reads `nau_at` cookie, verifies, returns payload or null.
- `requireSession(request: NextRequest): Promise<AccessTokenPayload>` — throws redirect to `/login` if no valid session.

---

## Configuration

```ts
// packages/auth/src/config.ts
export interface AuthConfig {
  secret: string;         // JWT_SECRET env var
  algorithm: 'HS256';     // RS256 path: see docs/future/rs256-jwks-migration.md
  accessTokenTtl: number; // 900 (15 min)
}
```

---

## What it does NOT do

- Issue tokens (that is 9naŭ API's job).
- Store sessions (9naŭ API + Redis).
- Handle cookies in middleware beyond reading (set-cookie is app responsibility).

---

## Related

- [../platform/AUTH.md](../platform/AUTH.md)
- [../decisions/ADR-004-auth-model.md](../decisions/ADR-004-auth-model.md)
- [../future/rs256-jwks-migration.md](../future/rs256-jwks-migration.md)
