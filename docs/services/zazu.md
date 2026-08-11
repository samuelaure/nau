# Service — zazu

- **Directory:** `apps/zazu` (package `@zazu/bot`). There is no `apps/zazu-bot`.
- **Role:** Telegram bot. Voice journaling, daily briefs, comment suggestion delivery, capture triage, platform commands.
- **Stack:** Node.js · Telegraf · Prisma · PostgreSQL
- **Owned entities:** `User` (holds `telegramId` and `nauUserId`), `Message`, `Voicenote`, `Feature`, `UserFeature`, `DeliveryWindow`, `Broadcast`, `NotificationQueue`
- **Admin UI:** not a separate app. Lives in `apps/accounts/src/app/admin/zazu/`, proxying to `/api/internal/admin/*`.

---

## Responsibilities

1. **Voice journaling** — transcription happens **here**, not in the API. `voicenote-skill.ts`
   downloads the `.ogg`, uploads it to R2, transcribes through the LLM client fallback chain
   (`groq/whisper-large-v3-turbo` → `openai/whisper-1`), cleans and summarises it, stores a
   `Voicenote` row, then splits the text by intent and dispatches: journal and actions to
   9naŭ API `/triage`, content ideas to nauthenticity.
2. **Daily briefs** — receive ideation briefs from flownaŭ, deliver as grouped messages.
3. **Comment suggestions** — receive suggestions from nauthenticity, deliver with inline keyboards.
4. **Capture commands** — `/capture`, `/brand`, etc., invoke platform actions.
5. **Telegram link handshake** — consume one-time link tokens to bind `telegramId` to `naŭ User.id`.

---

## Auth

- **Long polling, not a webhook** (`bot.launch()`), so there is no `TELEGRAM_WEBHOOK_SECRET`.
- Inbound service calls to Zazu's own `/api/internal/*` are verified with `requireServiceAuth`.
- Outgoing calls to 9naŭ API / nauthenticity use service JWTs signed with the shared
  `AUTH_SECRET` (not `ZAZU_SERVICE_SECRET`), with `aud` set to the target service.
- Make.com and the public webhooks use static shared secrets, not JWTs.

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
