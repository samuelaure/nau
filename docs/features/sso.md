# Feature — SSO (Single Sign-On)

- **Owner:** 9naŭ API (token issuance) + accounts (UI)
- **Entry points:** Any app redirecting to `accounts.9nau.com`

---

## Flow

```
User visits protected route on any subdomain
        │ no nau_at cookie
        ▼
App redirects → accounts.9nau.com/login?redirect_uri=<origin>
        │
        ▼
User submits credentials → accounts server action
        │ POST api.9nau.com/auth/login
        ▼
9naŭ API validates password → issues access token + refresh token
  access token:  nau_at  (15min, HttpOnly, Secure, SameSite=Lax, Domain=.9nau.com)
  refresh token: nau_rt  (30d,   HttpOnly, Secure, SameSite=Strict, Path=/auth/refresh)
        │
        ▼
accounts sets cookies on .9nau.com response
        │
        ▼
accounts redirects → original redirect_uri
        │ nau_at cookie now present on all *.9nau.com subdomains
        ▼
Destination app reads nau_at → verifies via @nau/auth → proceeds
```

---

## Token model

| Token | Name | TTL | Storage | Rotation |
|---|---|---|---|---|
| Access | `nau_at` | 15 min | HttpOnly cookie | No |
| Refresh | `nau_rt` | 30 days | HttpOnly cookie | Yes — rotate on every use |
| CSRF | `nau_csrf` | Session | JS-readable cookie | No |

Refresh token rotation includes reuse detection: if a previously-used refresh token is presented, the entire session family is invalidated (RFC 6819 §5.2.1 pattern).

---

## Auth entry points

| Method | Endpoint | Notes |
|---|---|---|
| Email + password | `POST /auth/login` | Standard credentials |
| Register | `POST /auth/register` | Creates User + default Workspace |
| Token refresh | `POST /auth/refresh` | Uses `nau_rt` cookie |
| Logout | `POST /auth/logout` | Clears cookies + invalidates session |
| Telegram link | `POST /auth/telegram-link` | Binds telegramId to User |
| Telegram login | `POST /auth/telegram-login` | Issues tokens for Telegram Mini App |

---

## Cross-subdomain cookies

All cookies set with `Domain=.9nau.com`. A login at `accounts.9nau.com` propagates to `flownau.9nau.com`, `nauthenticity.9nau.com`, etc. with no per-app login required.

---

## CSRF protection

`nau_csrf` is a random token stored in a JS-readable cookie (not HttpOnly). Mutating requests from browser clients must include `x-nau-csrf` header matching the cookie value. Server-side only (Next.js server actions) are exempt since they are not cross-origin reachable.

---

## Telegram auth (Mini App)

zazu-dashboard receives Telegram `initData` → verifies HMAC with `TELEGRAM_BOT_TOKEN` server-side → calls `POST api.9nau.com/auth/telegram-login` → receives tokens → sets `.9nau.com` cookies → normal SSO from that point.

---

## Mobile auth

Expo app stores `nau_at` + `nau_rt` in `expo-secure-store`. Refresh flow identical to web. No cookies — tokens passed as `Authorization: Bearer` headers.

---

## Related

- [../platform/AUTH.md](../platform/AUTH.md)
- [../services/accounts.md](../services/accounts.md)
- [../decisions/ADR-004-auth-model.md](../decisions/ADR-004-auth-model.md)
