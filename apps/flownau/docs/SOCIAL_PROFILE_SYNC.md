# Social Profile Sync: nauthenticity ↔ flownau

**Status**: Implemented (2026-04-27)
**Scope**: Automatic sync of brand-owned social profiles from nauthenticity to flownau for publishing

## Overview

When a brand owner adds a social profile in nauthenticity and marks it as "publishing" (owned), it automatically appears in flownau as that brand's social profile for content publishing. The user can then authorize the profile via Instagram OAuth to enable publishing.

## Database Changes

### flownau

**SocialProfile** model:
- `accessToken: String?` — Made optional to support "soft" profiles awaiting OAuth
- `syncedFromNauthenticity: Boolean` — Track if synced from nauthenticity
- `nauthenticityProfileId: String?` — Reference to source nauthenticity profile

### nauthenticity

**SocialProfileTarget** model:
- `isPublishingProfile: Boolean` — Mark as owned/publishing (vs. monitored)
- `syncedToFlownauAt: DateTime?` — Track successful sync to flownau

## API Endpoints

### flownau

**POST /api/brands/{brandId}/social-profiles**
Create a new social profile (soft add).
```json
{
  "username": "brand_account",
  "platform": "instagram",
  "nauthenticityProfileId": "abc123",          // optional, from nauthenticity
  "syncedFromNauthenticity": true              // optional
}
```

Response: `{ profile: SocialProfile }`

**GET /api/brands/{brandId}/social-profiles**
List all social profiles for a brand.

### nauthenticity

**PUT /social-profile-targets/{targetId}/publishing**
Toggle `isPublishingProfile` and sync to flownau.
```json
{
  "isPublishingProfile": true
}
```

Response: `{ target: SocialProfileTarget, synced: boolean }`

**POST /brands/{brandId}/social-profiles/sync**
Manually trigger batch sync for a brand.

Response: `{ syncedCount: number }`

## Workflow

### From nauthenticity

1. User adds a social profile in nauthenticity (e.g., via InspoBase, Instagram search)
2. User marks it as `isPublishingProfile: true`
3. **Automatic sync**:
   - nauthenticity calls flownau `POST /api/brands/{brandId}/social-profiles`
   - Profile created in flownau with `accessToken: null`
   - Status: "needs authorization"
4. User navigates to flownau, sees profile with "Authorize" button
5. User clicks "Authorize", redirected to Instagram OAuth
6. OAuth callback updates `accessToken` + `refreshToken`
7. Profile ready for publishing

### From flownau

1. User navigates to Brand Settings → Social Profiles
2. User clicks "+ Add Profile"
3. User enters Instagram username (or searches)
4. Profile created with `accessToken: null`
5. Status: "needs authorization"
6. User clicks "Authorize", completes OAuth
7. Profile ready for publishing

## UI Indicators

### Profile Status Badge

- **needs authorization** (yellow): OAuth tokens required
  - Action: "Authorize" button links to OAuth flow
- **authorized** (green): Ready for publishing
  - Action: "Revoke" to remove tokens (keeps profile)
  - Action: "Delete" to remove entire profile
- **synced from nauthenticity** (blue tag): Profile came from nauthenticity
  - Indicates data sync; user can still manage in flownau

## Implementation Notes

### Token Optional by Design

The `accessToken` field is nullable to allow:
- **Soft adds**: Profile discovery without immediate OAuth burden
- **Cross-app linking**: nauthenticity → flownau sync creates placeholder
- **Deferred authorization**: User authorizes later when ready to publish
- **Status clarity**: Missing token = "needs auth", triggers OAuth UI

### Sync Guarantees

- **One-time sync per profile**: `syncedToFlownauAt` prevents duplicates
- **Idempotent adds**: Creating same profile twice returns 409 Conflict
- **Service-to-service**: nauthenticity uses `X-Service-Key` header for auth

### Error Handling

- If nauthenticity sync fails, `syncedToFlownauAt` remains null
- Failed sync does NOT cascade; manual retry via API available
- Profile already exists: 409 Conflict, sync can proceed safely

## Future Enhancements

- **Profile status indicator**: Show if synced profile is active in nauthenticity
- **Bi-directional sync**: If user adds profile in flownau, create SocialProfileTarget in nauthenticity
- **Batch authorization**: Sign into multiple accounts via single OAuth
- **Permission model**: Track who authorized each profile (audit trail)
- **Token refresh**: Automatic refresh when `expiresAt` approaches
