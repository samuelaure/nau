# naŭ Platform — Global Identity Plan

This plan governs the cross-service identity enforcement, ensuring every naŭ user is linked to a Telegram identity (Zazŭ) for centralized communication.

## 1. Vision
Every naŭ Platform user should have a bi-directional link with Telegram.
- **Direction A**: Telegram users must connect a naŭ Account to access global blocks.
- **Direction B**: naŭ Account users must connect Telegram to receive system notifications.

## 2. Global Components

### The Identity Banner
- A portable React component that checks `user.telegramId`.
- Displays a mandatory invitation to link Zazŭ.
- dismissal logic: reappears every 12 hours.

### The OTT (One-Time Token) Handshake
- **Generator**: `9nau-api` creates a signed, 5-minute token.
- **Link**: `https://t.me/zazu_bot?start=token_[TOKEN]`.
- **Consumer**: Zazŭ Bot reads the token on `/start` and notifies the API to bind the IDs.

## 3. Execution Roadmap

### Phase 1: Universal Telegram Enforcement (Current)
-   Implement OTT generation in `9nau-api`.
-   Create a shared `<TelegramLinkBanner />` in `packages/ui`.
-   Integrate banner into `app.9nau.com` and `accounts.9nau.com`.
-   Update Zazŭ Bot `/start` handler to process linking tokens.

### Phase 2: Cross-Service Notification Routing
-   Ensure `flownaŭ` and `naŭthenticity` can route alerts directly to the linked Telegram ID.

## 4. Key Decisions
- **2026-04-18**: Non-blocking enforcement. Users are invited to link but not locked out of their accounts.
- **2026-04-18**: Centralized mapping. `9nau-api` remains the source of truth for the `User.telegramId` field.
# Phase 1: Universal Telegram Enforcement

Objective: Implement the seamless OOT (One-Time Token) flow to link naŭ Accounts to Telegram from any platform app.

## Tasks

### 1. API - Token Generator
- [ ] Update `9nau/apps/api`:
    - [ ] Create `AuthLinkToken` model in Prisma (short-lived random string).
    - [ ] Add `POST /api/auth/link-token` (requires authentication).
    - [ ] Add `POST /api/auth/link-token/verify` (requires service auth).

### 2. Shared Logic & UI
- [ ] Create `@9nau/ui/components/TelegramLinkBanner.tsx`:
    - [ ] Fetch link token from API.
    - [ ] "Link Zazŭ" button -> redirects to Telegram.
    - [ ] Cookie-based dismissal logic (reappears after 12h).
- [ ] Integrate into `9nau/apps/app/layout.tsx`.
- [ ] Integrate into `9nau/apps/accounts/layout.tsx`.

### 3. Zazŭ Bot - Handshake
- [ ] Update `zazu/apps/bot`:
    - [ ] Intercept `/start` command with params.
    - [ ] If param starts with `link-`, call `9nau-api/verify` with the token and the sender's Telegram ID.
    - [ ] Respond with "Success! Your naŭ Account has been linked."

## Verification Criteria
- [ ] New naŭ Account user sees the banner on `app.9nau.com`.
- [ ] Clicking the banner opens Telegram.
- [ ] hitting "Start" in the bot triggers the link.
- [ ] Banner disappears from both `app.9nau.com` and `accounts.9nau.com` immediately.
- [ ] `User.telegramId` is correctly populated in `api.9nau.com` database.
