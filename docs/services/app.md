# Service — 9naŭ app (Second Brain)

- **Domain:** `app.9nau.com`
- **Role:** Personal productivity Second Brain web app. Block editor, journal, search, triage inbox, reminders.
- **Stack:** Next.js 15

---

## Responsibilities

1. Display the user's Second Brain: blocks organized by type, period, relation.
2. Capture raw input (text, voice) → triage to 9naŭ API → structured blocks.
3. Journal summaries (daily, weekly, monthly syntheses).
4. Scheduling + reminders UI.
5. Brand + workspace management UI (centralized control plane UI).

---

## Auth

- Reads `nau_at` cookie from `.9nau.com`.
- Redirects unauthenticated users to `accounts.9nau.com/login?continue=...`.
- No local sessions; fully delegates to 9naŭ SSO.

---

## Data

Owns no data. All reads/writes go to 9naŭ API via `@nau/sdk`.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Yes | This app's URL |
| `NEXT_PUBLIC_ACCOUNTS_URL` | Yes | `https://accounts.9nau.com` |
| `NAU_API_URL` | Yes | 9naŭ API URL (internal) |
| `AUTH_SECRET` | Yes (HS256 phase) | Cookie JWT verification |

---

## Status

🟡 Deploying / containerization in progress.

## Related

- [../services/9nau-api.md](9nau-api.md)
- [../platform/AUTH.md](../platform/AUTH.md)
