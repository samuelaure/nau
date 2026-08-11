# Service — 9naŭ mobile

> **Not in this monorepo.** The app is a standalone repository:
> `github.com/samuelaure/nau-mobile`. There is no `apps/mobile`. Its own docs live at
> `docs/architecture-refactor.md` inside that repo and are the authoritative source.

- **Package:** `com.nau.ig` (Android; preserved from nau-ig for in-place update)
- **Role:** Instagram capture and personal knowledge app.
- **Stack:** Expo SDK 50 / React Native 0.73 (deliberately frozen)
- **Status:** 🟡 the app runs, but it cannot currently reach the API — wrong path prefix and
  a retired auth header. Captures render as permanently "processing" because `mediaData` is
  never populated. See the repo's own docs.

---

## Responsibilities

1. **Instagram capture overlay** — floating modal shown over Instagram to send the active post to InspoBase, trigger reactive comment suggestion, or replicate a post.
2. **Second Brain on mobile** — browse captures, tag them, review on a spaced schedule.
3. **Brand selector** — choose active brand context for captures (Special Functions).

Voice capture is **not** implemented here; voice journaling goes through Zazu on Telegram.
A journal view does not exist on mobile either — that is web-only today.

---

## Auth

The app is **local-first**: fully usable with no account and no network. Cloud sync and
backup are opt-in and activate only once the user creates or links a naŭ account, with a
toggle that can be switched off and back on.

Target model: link via `accounts.9nau.com`, store the token in the platform secure store.
No service secret ships in the binary.

> Current state does not match this yet: the app still sends a hardcoded `x-nau-service-key`
> which the API no longer accepts. There is no `@nau/sdk` mobile adapter — the app uses its
> own HTTP calls.

---

## Data

**Owns its data.** A local SQLite database (`nau_ig.db`) is the primary store for captures,
labels and review scheduling. The API is a sync target, not the source of truth.

This matters for recovery: the Instagram CDN URLs of the 968 existing captures have expired,
so the device holds the only copy of that media.

---

## Environment variables (via Expo config)

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | 9naŭ API base URL |
| `EXPO_PUBLIC_ACCOUNTS_URL` | Yes | SSO login URL |
| `EXPO_PUBLIC_NAUTHENTICITY_URL` | Yes | nauthenticity base URL |
| `EXPO_PUBLIC_FLOWNAU_URL` | Yes | flownaŭ base URL |

---

## Android identity

- **Namespace:** `com.nau.ig`
- **Keystore:** debug keystore at `android/app/debug.keystore`; release keystore must match the original `nau-ig` keystore for in-place OS update.

---

## Status

🟢 Production.

## Related

- [../features/content-creation-pipeline.md](../features/content-creation-pipeline.md) — how captures feed ideation
- [../features/brand-intelligence.md](../features/brand-intelligence.md) — how captures feed intelligence
