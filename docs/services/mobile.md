# Service — 9naŭ mobile

- **Package:** `com.nau.ig` (Android; preserved from nau-ig for in-place update)
- **Role:** Mobile companion app. Instagram overlay for post capture, voice capture, Second Brain access.
- **Stack:** Expo / React Native

---

## Responsibilities

1. **Instagram capture overlay** — floating modal shown over Instagram to send the active post to InspoBase, trigger reactive comment suggestion, or replicate a post.
2. **Voice capture** — record audio → upload to 9naŭ API → triage.
3. **Second Brain on mobile** — browse blocks, journal, recent syntheses.
4. **Brand selector** — choose active brand context for captures.

---

## Auth

- Bearer tokens (no cookies on mobile).
- Login via `accounts.9nau.com` hosted in an in-app browser → exchange for tokens → store in Keychain / EncryptedSharedPreferences.
- Access token refresh handled automatically by `@nau/sdk`'s mobile adapter.

---

## Data

Owns no data. All interactions flow through 9naŭ API, nauthenticity, flownaŭ via `@nau/sdk`.

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
