# naŭ Platform — API Contract

> Canonical catalog of every HTTP endpoint across the platform. Use this doc to find or cite an endpoint; update it whenever an endpoint is added, removed, or changed.

Legend:
- **Auth** column:
  - `PUBLIC` — no auth
  - `USER` — requires user JWT (`nau_at` cookie or `Authorization: Bearer <user-jwt>`)
  - `USER + SCOPE(x)` — requires specific scope
  - `SERVICE` — requires service JWT (`Authorization: Bearer <service-jwt>`, verified via `ServiceClient`)
  - `CRON` — requires cron secret (`Authorization: Bearer <CRON_SECRET>`)

---

## 1. `api.9nau.com` — 9naŭ API (control plane)

Base URL: `https://api.9nau.com` (routes at root, no `/api` prefix).

### 1.1. Discovery

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | PUBLIC | Health check |
| GET | `/.well-known/openid-configuration` | PUBLIC | OIDC discovery metadata |
| GET | `/.well-known/jwks.json` | PUBLIC | JWKS (stub during HS256; live after RS256 migration) |

### 1.2. Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | PUBLIC | Register user |
| POST | `/auth/login` | PUBLIC | Login → `{ accessToken, refreshToken }` |
| POST | `/auth/refresh` | PUBLIC (refresh token in body) | Rotate token pair |
| POST | `/auth/logout` | PUBLIC (refresh token in body) | Revoke session |
| GET | `/auth/me` | USER | Current user info |
| POST | `/auth/link-telegram` | USER | Bind telegramId to user |
| POST | `/auth/link-token` | USER | Generate one-time Telegram link token |
| POST | `/auth/link-token/verify` | SERVICE (zazu) | Consume link token + bind telegramId |
| GET | `/auth/by-telegram/:tgId` | SERVICE | Look up user by telegramId |
| GET | `/auth/lookup?email=X` | SERVICE | Look up user by email |

### 1.3. Workspaces

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/workspaces` | USER | List user's workspaces |
| POST | `/workspaces` | USER | Create workspace |
| GET | `/workspaces/:id` | USER + member | Get workspace |
| PATCH | `/workspaces/:id` | USER + admin | Rename workspace |
| DELETE | `/workspaces/:id` | USER + owner | Delete workspace |
| GET | `/workspaces/service/user/:userId` | SERVICE | Service-scope list (zazu, internal) |

### 1.4. Workspace members

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/workspaces/:id/members` | USER + member | List members |
| POST | `/workspaces/:id/members` | USER + owner | Invite member by email |
| PUT | `/workspaces/:id/members/:userId` | USER + owner | Update member role |
| DELETE | `/workspaces/:id/members/:userId` | USER + owner | Remove member |

### 1.5. Brands

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/workspaces/:id/brands` | USER + member | List brands in workspace |
| POST | `/workspaces/:id/brands` | USER + admin | Create brand |
| GET | `/brands/:id` | USER + member-of-workspace | Get brand (flat accessor) |
| PATCH | `/brands/:id` | USER + admin | Update brand (including DNA fields) |
| DELETE | `/brands/:id` | USER + admin | Delete brand |
| POST | `/brands/:id/set-default` | USER + admin | Set as default brand in workspace |

### 1.6. Social profiles

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/brands/:id/social-profiles` | USER + member | List social profiles for a brand, optionally `?role=OWNED` |
| POST | `/brands/:id/social-profiles` | USER + admin | Create social profile |
| GET | `/social-profiles/:id` | USER + member-of-brand | Get social profile |
| PATCH | `/social-profiles/:id` | USER + admin | Update social profile |
| DELETE | `/social-profiles/:id` | USER + admin | Delete social profile |
| POST | `/social-profiles/:id/set-default` | USER + admin | Mark as default for its brand (scoped to its role) |

### 1.7. Prompts

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/brands/:id/prompts` | USER + member | List prompts (`?type=VOICE`) |
| POST | `/brands/:id/prompts` | USER + admin | Create prompt (defaults `ownerType=BRAND`) |
| GET | `/prompts/:id` | USER + member | Get prompt |
| PATCH | `/prompts/:id` | USER + admin | Update prompt |
| DELETE | `/prompts/:id` | USER + admin | Delete prompt |
| GET | `/prompts/resolve` | USER or SERVICE | `?ownerType=X&ownerId=Y&type=Z` — resolves with fallback (BRAND → WORKSPACE → PLATFORM) |

### 1.8. Second Brain (9naŭ app domain)

(Retained from the existing API surface. Covered in [../services/9nau-api.md](../services/9nau-api.md).)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/blocks` | USER | List blocks |
| POST | `/blocks` | USER | Create block |
| GET | `/blocks/:id` | USER | Get block |
| PUT | `/blocks/:id` | USER | Update block |
| DELETE | `/blocks/:id` | USER | Soft-delete block |
| GET | `/blocks/remindable` | USER | Blocks due for reminder |
| POST | `/relations` | USER | Create block relation |
| DELETE | `/relations/:id` | USER | Remove relation |
| POST | `/schedule` | USER | Upsert block schedule |
| GET | `/schedule/:blockId` | USER | Get schedule |
| POST | `/sync/push` | USER | Push dirty blocks |
| GET | `/sync/pull` | USER | Pull blocks since cursor |
| POST | `/triage` | USER | Triage raw text/transcription |
| POST | `/triage/retroprocess` | USER + admin | Retroprocess voice captures |
| POST | `/journal/summary` | USER | Generate period synthesis |
| POST | `/media/upload` | USER | Upload to R2 |
| GET | `/media/:fileId` | USER | Stream/redirect media |

---

## 2. `accounts.9nau.com` — SSO identity provider UI

Thin layer; proxies auth operations to `api.9nau.com` and sets cookies.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/login` | PUBLIC | Login form UI |
| GET | `/register` | PUBLIC | Register form UI |
| POST | `/api/auth/login` | PUBLIC | Proxy to `api/auth/login`; set `nau_at` + `nau_rt` cookies; redirect to `continue` |
| POST | `/api/auth/register` | PUBLIC | Same pattern for register |
| POST | `/api/auth/refresh` | PUBLIC | Rotate cookies via `api/auth/refresh` |
| POST | `/api/auth/logout` | PUBLIC | Revoke via `api/auth/logout`; clear cookies |

---

## 3. `flownau.9nau.com` — Content creation engine

Base: `https://flownau.9nau.com`. API under `/api/v1/`.

### 3.1. Content (brand-scoped)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/brands/:id/content/ideas` | USER + member | List ideas |
| POST | `/api/v1/brands/:id/content/ideas` | USER + member | Create idea |
| PATCH | `/api/v1/content/ideas/:id` | USER + member | Update |
| DELETE | `/api/v1/content/ideas/:id` | USER + admin | Delete |
| GET | `/api/v1/brands/:id/content/compositions` | USER + member | List compositions |
| POST | `/api/v1/brands/:id/content/compositions` | USER + member | Create composition |
| GET | `/api/v1/content/compositions/:id` | USER + member | Get |
| PATCH | `/api/v1/content/compositions/:id` | USER + member | Update |
| POST | `/api/v1/content/compositions/:id/approve-post` | USER + member | Approve for publishing |
| POST | `/api/v1/content/compositions/:id/mark-posted` | USER + member | Mark externally posted |
| GET | `/api/v1/brands/:id/content/templates` | USER + member | List templates |
| POST | `/api/v1/brands/:id/content/templates` | USER + admin | Create template |
| ...etc |

### 3.2. Assets (social-profile-scoped)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/social-profiles/:id/assets` | USER + member | List |
| POST | `/api/v1/social-profiles/:id/assets` | USER + member | Prepare upload (presigned R2) |
| DELETE | `/api/v1/content/assets/:id` | USER + member | Delete |

### 3.3. Plans

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/social-profiles/:id/daily-plan` | USER + member | Current daily plan |
| POST | `/api/v1/brands/:id/content/planners` | USER + admin | Create planner config |

### 3.4. Service ingestion

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/ingest/ideas` | SERVICE (9naŭ API, zazu) | Bulk ingest content ideas |

### 3.5. Cron

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/cron/ideation` | CRON | Generate new ideas for all auto-approve brands |
| GET | `/api/cron/composer` | CRON | Compose approved ideas |
| GET | `/api/cron/renderer` | CRON | Render pending compositions |
| GET | `/api/cron/publisher` | CRON | Publish ready compositions |
| GET | `/api/cron/scheduler` | CRON | Schedule upcoming posts |
| GET | `/api/cron/token-refresh` | CRON | Refresh Instagram OAuth tokens |
| GET | `/api/cron/daily-plan` | CRON | Build daily plans |

### 3.6. OAuth callbacks (platform integrations)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/auth/instagram/login` | USER | Begin Instagram OAuth |
| GET | `/api/auth/instagram/callback` | PUBLIC (state-based CSRF) | OAuth code exchange |

---

## 4. `nauthenticity.9nau.com` — Brand intelligence

Base: `https://nauthenticity.9nau.com`. API under `/api/v1/`.

### 4.1. InspoBase (brand-scoped)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/brands/:id/inspo` | USER + member | List inspo items |
| POST | `/api/v1/brands/:id/inspo` | USER + member, or SERVICE | Add inspo (from mobile capture) |
| GET | `/api/v1/brands/:id/inspo/digest` | USER or SERVICE (flownaŭ) | Ideation-ready digest |
| PATCH | `/api/v1/inspo/:id` | USER + member | Update status / metadata |
| DELETE | `/api/v1/inspo/:id` | USER + member | Delete |

### 4.2. Benchmark / monitoring (social-profile-scoped)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/social-profiles/:id/posts` | USER + member | List scraped posts |
| GET | `/api/v1/social-profiles/:id/transcripts` | USER + member | List transcripts |
| POST | `/api/v1/social-profiles/:id/scrape` | USER + admin | Trigger scrape job |
| POST | `/api/v1/social-profiles/:id/chat` | USER + member | RAG chat with profile data |

### 4.3. Brand synthesis

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/brands/:id/synthesis` | USER + member | List syntheses |
| POST | `/api/v1/brands/:id/synthesis` | USER + member | Generate synthesis |

### 4.4. Comment suggestions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/brands/:id/comment-suggestions` | USER + member | Generate N suggestions for a post URL |
| POST | `/api/v1/comment-feedback` | USER + member | Record user selection |

### 4.5. Service endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/service/brands/:id/dna-light` | SERVICE | Ultra-light DNA for triage routing |
| POST | `/api/v1/service/ingestion` | SERVICE | Internal ingestion trigger |

---

## 5. `zazu.9nau.com` — Telegram Mini App

Base: `https://zazu.9nau.com`. API under `/api/`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/telegram/initdata` | PUBLIC (verified via HMAC) | Exchange Telegram initData for `nau_at` cookie (via 9naŭ API) |
| (other routes mostly UI pages and consumer API calls through @nau/sdk) |

---

## 6. zazu-bot (Telegram webhook)

Not a public HTTP surface in the product sense; webhook from Telegram Bot API.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/telegram/webhook` | Telegram secret token | Bot update handler |
| GET | `/health` | PUBLIC | Health |

---

## 7. whatsnaŭ

Out of scope for this foundational refactor. Existing surface documented in [../services/whatsnau.md](../services/whatsnau.md).

---

## 8. Cross-cutting response conventions

All JSON responses follow:

### 8.1. Success

```json
{
  "data": { ... }    // or array for collections
}
```

### 8.2. Error

```json
{
  "error": {
    "code": "WORKSPACE_NOT_FOUND",
    "message": "Workspace does not exist or you don't have access.",
    "details": { ... }
  }
}
```

Error codes are UPPER_SNAKE_CASE, stable across versions, documented per endpoint.

### 8.3. Pagination

```json
{
  "data": [ ... ],
  "pagination": {
    "total": 123,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

Query params: `?page=1&limit=50`.

### 8.4. HTTP status codes

- `200 OK` — success
- `201 Created` — resource created
- `204 No Content` — success with no body (DELETEs)
- `400 Bad Request` — validation error
- `401 Unauthorized` — auth missing/invalid
- `403 Forbidden` — auth OK but not allowed
- `404 Not Found`
- `409 Conflict` — uniqueness violations, state conflicts
- `422 Unprocessable Entity` — semantic validation errors (preferred over 400 for zod errors)
- `429 Too Many Requests` — rate limited
- `500 Internal Server Error`
- `502 Bad Gateway` — upstream service failure
- `503 Service Unavailable` — maintenance / overload

---

## 9. Related

- [AUTH.md](AUTH.md) — full auth spec
- [NAMING.md](NAMING.md) — URL and header naming rules
- Per-service endpoint details: [../services/](../services/)
