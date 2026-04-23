# Future — RS256 + JWKS Migration

> Upgrading JWT signing from HS256 (symmetric) to RS256 (asymmetric) with a public JWKS endpoint.

**Status:** scoped, not executed. `@nau/auth` is built algorithm-agnostic so this migration is a config change, not a rewrite.

---

## Why

Current model (HS256) requires every service to hold the same secret (`AUTH_SECRET`) to verify tokens. Consequences:

- A leak in any service compromises token forgery for the entire platform.
- Third-party integrations that verify tokens would need the secret — impossible.
- No way to rotate the signing secret without simultaneous rollout to every service.

Industry-standard for multi-consumer JWTs is RS256 (or EdDSA):

- **9naŭ API holds the private key** (signing).
- **Every other service holds only the public key** (verifying). Obtained via `/.well-known/jwks.json`.
- Private key compromise is isolated to 9naŭ API; leak does not allow forgery elsewhere.
- Rotation is non-disruptive: publish new public key in JWKS alongside old, sign new tokens with new key, retire old after TTL.
- Third-party integrations can verify tokens without any shared secret.

## Target configuration

### 9naŭ API (signer)

```ts
// apps/9nau-api/src/auth/keys.ts
import { generateKeyPairSync } from 'crypto'

// Generated once, stored in secret manager
const privateKey = loadPrivateKey()         // PEM
const publicKey  = loadPublicKey()          // PEM, served via JWKS

signAccessToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'key-2026-04' })
    .sign(privateKey)
}
```

### JWKS endpoint

`GET https://api.9nau.com/.well-known/jwks.json`

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key-2026-04",
      "use": "sig",
      "alg": "RS256",
      "n": "<modulus base64url>",
      "e": "AQAB"
    }
  ]
}
```

### Consumer services (verifiers)

```ts
// packages/auth/src/verify.ts
import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS = createRemoteJWKSet(new URL('https://api.9nau.com/.well-known/jwks.json'))

export async function verifyUserToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'api.9nau.com',
    audience: 'nau-platform',
  })
  return payload
}
```

`createRemoteJWKSet` caches keys locally with 10-minute refresh.

## Migration plan

### Phase RS-1: add RS256 support alongside HS256

1. Generate RS256 keypair; store private key in 9naŭ API's secret manager.
2. 9naŭ API signs **new** tokens with RS256, including `kid` header.
3. 9naŭ API publishes JWKS with the new public key.
4. `@nau/auth` verifier tries RS256 via JWKS first, falls back to HS256 via shared secret. No app code change.
5. Rolling-deploy all consumer services.

### Phase RS-2: retire HS256

1. Ensure all in-flight HS256 tokens have expired (wait 30 days — full refresh cycle).
2. 9naŭ API stops accepting HS256-signed service tokens.
3. Consumer services drop HS256 fallback.
4. Remove `AUTH_SECRET` env var from all services.

### Key rotation (ongoing)

- Rotate signing key annually (or on any suspected compromise).
- Publish new key in JWKS alongside old (two `keys[]` entries).
- Start signing with new key; old key remains valid for verification during TTL (30 days).
- Remove old key from JWKS after TTL.

## When to execute

After Phase 9 completes and the platform has stabilized on the new model. Low priority until either:
- First third-party integration needs token verification without a shared secret, or
- Security audit requires it.

## Operational considerations

- **Secret management**: private key lives in a proper KMS (AWS KMS, GCP KMS, HashiCorp Vault). Dev environments can use a local file or env var.
- **JWKS caching**: consumer services cache JWKS with 10-min refresh. Avoid hammering the endpoint.
- **Algorithm allowlist**: strictly verify `alg` is RS256 (never accept `alg: none` or downgrades to HS256 once phase RS-2 completes).
- **Key IDs (`kid`)**: every token header includes `kid` so verifiers pick the right key during rotation windows.

## Related

- [../platform/AUTH.md](../platform/AUTH.md) — current auth model
- [../packages/auth.md](../packages/auth.md) — `@nau/auth` abstraction
- [ADR-004](../decisions/ADR-004-auth-model.md) — why this is the chosen upgrade path
