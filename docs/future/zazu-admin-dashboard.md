# Zazŭ Admin Dashboard

**Status**: Planning  
**Priority**: Medium  
**Location**: `accounts.9nau.com/admin/zazu`  
**Access**: `ADMIN_EMAIL` env var gate (currently `samuelaure@gmail.com`)

## Context

`apps/zazu-dashboard` was removed in the `refactor/remove-zazu-dashboard` branch. Its admin functionality needs to be ported into `accounts.9nau.com/admin/zazu`, replacing the placeholder two-form panel that currently exists there.

## Screens

### 1. Users (`/admin/zazu`)
- Table of all Zazu DB users: display name, telegramId, linked/unlinked `nauUserId` status, delivery window, last active
- "Send message" action per row — opens inline modal, posts to existing `POST /api/internal/admin/message`
- Data source: new Zazu endpoint `GET /api/internal/admin/users`

### 2. Broadcast (`/admin/zazu/broadcast`)
- Textarea + two-click confirm guard (already exists in current placeholder, keep pattern)
- Shows sent count on completion
- Posts to existing `POST /api/internal/admin/broadcast`

### 3. Settings (`/admin/zazu/settings`)
- Display bot polling status (`SKIP_TELEGRAM_POLLING`)
- Read/write delivery window defaults from Zazu DB
- Future: toggle notification types per user

## Architecture

- Shared `AdminLayout` component with tab nav across the three screens
- User list fetched server-side (RSC) via accounts `GET /api/admin/zazu/users` route handler
- Route handler signs service JWT and calls Zazu's new `GET /api/internal/admin/users`
- Client interactions (send message, broadcast) use existing `/api/admin/zazu/*` route handlers

## New Work Required

### Zazu (`apps/zazu/src/proactive-delivery.ts`)
```
GET /api/internal/admin/users
→ prisma.user.findMany({ select: { telegramId, displayName, firstName, nauUserId, createdAt } })
→ also join deliveryWindow if exists
```

### Accounts (`apps/accounts/src/app/`)
```
admin/zazu/layout.tsx          — AdminLayout with tab nav (Users / Broadcast / Settings)
admin/zazu/page.tsx            — Users screen (server component, fetches user list)
admin/zazu/UsersTable.tsx      — Client table with send-message modal
admin/zazu/broadcast/page.tsx  — Broadcast screen
admin/zazu/settings/page.tsx   — Settings screen
api/admin/zazu/users/route.ts  — GET handler, proxies to Zazu with service JWT
```

## What Was in zazu-dashboard Worth Porting

| Old component | Maps to |
|---|---|
| `AdminDashboard.tsx` | Users screen + tab nav |
| `ChatWindow.tsx` | Send-message modal per user |
| `ClientBrandsList.tsx` | Not needed — brands live in api/flownau |
| `SettingsPanel.tsx` | Settings screen |
| `WorkspaceContextPanel.tsx` | Not needed |

`ClientBrandsList` and `WorkspaceContextPanel` had significant dead/broken code tied to the old NextAuth session — not worth porting.
