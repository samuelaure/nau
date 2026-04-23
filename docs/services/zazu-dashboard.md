# Service — zazu-dashboard

- **Domain:** `zazu.9nau.com`
- **Role:** Telegram Mini App. In-chat UI for brand selection, target management, feedback.
- **Stack:** Next.js 15

---

## Responsibilities

1. Render the Telegram Mini App UI launched from the bot.
2. Authenticate via Telegram `initData` → verify HMAC server-side → exchange for `nau_at` cookie via 9naŭ API.
3. Manage brands, targets, and settings via `@nau/sdk` (user JWT context).

---

## Auth

**Post Phase 7:** zazu-dashboard uses naŭ SSO like every other subdomain.

- Telegram initData → server action verifies HMAC against Telegram bot token → calls 9naŭ API `/auth/telegram-login` → receives access+refresh tokens → sets cookies on `.9nau.com`.
- All subsequent operations go through `@nau/auth` / `@nau/sdk` user context.
- NextAuth dropped.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Yes | This app's URL |
| `NAU_API_URL` | Yes | 9naŭ API base |
| `TELEGRAM_BOT_TOKEN` | Yes | For initData HMAC verification |
| `AUTH_SECRET` | Yes (HS256 phase) | Cookie JWT verification |

---

## Status

🟡 Pre-refactor — currently uses NextAuth with separate session model. Migration to naŭ SSO in Phase 7.

## Related

- [../services/zazu-bot.md](zazu-bot.md)
- [../platform/AUTH.md](../platform/AUTH.md)
