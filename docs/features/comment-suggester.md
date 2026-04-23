# Feature — Comment Suggester

- **Owner:** nauthenticity (generation) + zazu-bot (delivery)
- **Entry points:** 9naŭ mobile overlay, zazu-bot commands, proactive monitor

---

## Modes

### Reactive (user-triggered)

User taps "Suggest comment" on a target post in 9naŭ mobile.

```
POST nauthenticity /api/v1/brands/:brandId/comment-suggestions
  body: { postUrl }
  auth: user JWT
        │
        ▼
  Scrape post → extract content
        │
        ▼
  Fetch brand's COMMENT_STRATEGY prompt from 9naŭ API
        │
        ▼
  Generate 3 comment variants via OpenAI
        │
        ▼
  Deliver via zazu-bot → Telegram inline keyboard
        │
        ▼
  User taps variant → CommentFeedback logged
```

### Proactive (scheduled)

For `SocialProfile` rows with `role: COMMENT_TARGET`, nauthenticity monitors for new posts and auto-generates suggestions without user trigger. Delivered via zazu-bot on a schedule.

---

## Prompt dependency

`COMMENT_STRATEGY` prompt owned by 9naŭ API, scoped to `(ownerType: BRAND, ownerId: brandId)`. Fetched via `@nau/sdk`.

---

## Feedback loop

`CommentFeedback` rows (owned by nauthenticity) capture which variant the user chose (or rejected). Future: use feedback to fine-tune prompt selection.

---

## Delivery channel

zazu-bot receives suggestion payload via HTTP from nauthenticity (service JWT), then sends Telegram message with inline keyboard. The bot does not generate suggestions — nauthenticity does.

---

## Related

- [../services/nauthenticity.md](../services/nauthenticity.md)
- [../services/zazu-bot.md](../services/zazu-bot.md)
- [brand-intelligence.md](brand-intelligence.md)
