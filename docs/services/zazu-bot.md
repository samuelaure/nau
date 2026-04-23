# Service — zazu-bot

- **Role:** Telegram bot. Voice journaling, daily briefs, comment suggestion delivery, capture triage, platform commands.
- **Stack:** Node.js · Telegraf · Prisma · PostgreSQL
- **Owned entities:** `TelegramUser` (link table between Telegram ID and naŭ User), `ConversationState`

---

## Responsibilities

1. **Voice journaling** — forward voice messages to 9naŭ API `/triage` for transcription + classification.
2. **Daily briefs** — receive ideation briefs from flownaŭ, deliver as grouped messages.
3. **Comment suggestions** — receive suggestions from nauthenticity, deliver with inline keyboards.
4. **Capture commands** — `/capture`, `/brand`, etc., invoke platform actions.
5. **Telegram link handshake** — consume one-time link tokens to bind `telegramId` to `naŭ User.id`.

---

## Auth

- Incoming Telegram updates authenticated via Telegram secret token on webhook.
- Outgoing calls to 9naŭ API / flownaŭ / nauthenticity use service JWTs signed with `ZAZU_SERVICE_SECRET`.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Zazu's local Postgres |
| `TELEGRAM_BOT_TOKEN` | Yes | Bot API auth |
| `TELEGRAM_WEBHOOK_SECRET` | Yes | Verifies incoming webhooks |
| `ZAZU_SERVICE_SECRET` | Yes | Signs outgoing service JWTs |
| `NAU_API_URL` | Yes | 9naŭ API base |
| `FLOWNAU_URL` | Yes | flownaŭ base |
| `NAUTHENTICITY_URL` | Yes | nauthenticity base |
| `ADMIN_TELEGRAM_ID` | No | Admin allowlist |

---

## Related

- [../services/zazu-dashboard.md](zazu-dashboard.md)
- [../features/comment-suggester.md](../features/comment-suggester.md)
