# Service — accounts

- **Domain:** `accounts.9nau.com`
- **Role:** SSO identity provider UI. The only app that renders login / register forms. Proxies auth operations to 9naŭ API and sets cookies on `.9nau.com`.
- **Stack:** Next.js 15 (server actions)
- **Owned entities:** none. Stateless. Proxies to 9naŭ API.

---

## Responsibilities

1. Render `/login`, `/register`, `/forgot-password`, `/reset-password` UIs.
2. Accept form submissions via server actions.
3. Call 9naŭ API (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`) and set/clear `nau_at` + `nau_rt` cookies on `.9nau.com`.
4. Redirect to the `continue` URL after successful auth (NO token in URL).
5. Host the Telegram linking flow (`TelegramLinkBanner` surfaced by 9naŭ API's link-token endpoint).

---

## Security invariants

- **All `Set-Cookie` writes happen server-side.** No `document.cookie` writes for auth tokens.
- **Cookies use `HttpOnly; Secure; Domain=.9nau.com`.**
- **No token forwarded in URL.** The `continue` param points at a post-login landing page; cookies travel automatically.
- **CSRF protection** on state-changing server actions via double-submit cookie pattern (`@nau/auth/next`).

---

## URL surface

See [../platform/API-CONTRACT.md §2](../platform/API-CONTRACT.md#2-accounts9naucom--sso-identity-provider-ui).

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Yes | This app's URL (`https://accounts.9nau.com`) |
| `NAU_API_URL` | Yes | Internal 9naŭ API URL |
| `AUTH_SECRET` | Yes (HS256 phase) | JWT verification secret |
| `COOKIE_DOMAIN` | No | Default `.9nau.com`; override in dev |

---

## Status

🟡 Pre-refactor — current implementation sets cookies via `document.cookie` and forwards tokens via `?token=` URL param. Rebuild in Phase 4.

## Related

- [../platform/AUTH.md](../platform/AUTH.md)
- [../features/sso.md](../features/sso.md)
