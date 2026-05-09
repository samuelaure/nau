# Feature Plan: Trial Reel Eligibility Gate

## Context

Trial Reels on Instagram require a minimum of **200 followers**. Accounts below this threshold receive Instagram API error `code: 10, error_subcode: 2207081` ("Trial Reel Not Enough Followers") — a non-transient, non-retryable failure.

Currently the pipeline discovers this at publish time, after the reel has already been rendered and scheduled. The fix already in place falls back to a regular reel on 2207081, but the UX is suboptimal: the user set a format the account isn't eligible for.

## Goal

Block or warn before the user can select `trial_reel` as a post format for an ineligible account. Eligibility should be checked proactively and kept fresh, not discovered at publish time.

---

## Implementation Plan

### 1. Store follower count on `SocialProfile` (api)

Add `followersCount: Int?` and `followersCountUpdatedAt: DateTime?` to the `SocialProfile` table in `apps/api`.

```sql
ALTER TABLE "SocialProfile"
  ADD COLUMN "followersCount" INTEGER,
  ADD COLUMN "followersCountUpdatedAt" TIMESTAMP(3);
```

### 2. Sync follower count from Instagram Graph API

The Instagram Graph API exposes `followers_count` on the IG User object:
```
GET /{ig-user-id}?fields=followers_count&access_token=...
```

**When to sync:**
- On `SocialProfile` creation / OAuth connection
- Daily background job (cron in `api` or `flownau`) refreshing all connected profiles
- On-demand when the user opens brand settings in `apps/app`

Suggested cron schedule: once per day per profile, alongside token refresh.

Store the result in `followersCount` + `followersCountUpdatedAt`. Treat as stale after 24h.

### 3. Eligibility helper

In `apps/api` (shared via SDK response) or `apps/flownau`:

```ts
const TRIAL_REEL_MIN_FOLLOWERS = 200

function isTrialReelEligible(profile: SocialProfile): boolean {
  return (profile.followersCount ?? 0) >= TRIAL_REEL_MIN_FOLLOWERS
}
```

### 4. UI gate in `apps/app` (post composer)

When the user selects the post format:
- If `trial_reel` is selected and `!isTrialReelEligible(profile)`:
  - Disable the option with a tooltip: *"Trial Reels require 200+ followers. This account has X followers."*
  - Or show an inline warning if already selected

Expose `followersCount` from `GET /brands/:id/social-profiles` in the API response.

### 5. Pipeline guard in `apps/flownau`

In `PublishOrchestrator`, before attempting `publishTrialReel`, check eligibility using the stored `followersCount`. If ineligible, skip trial and publish as regular reel immediately (without burning a publish attempt):

```ts
case 'trial_reel': {
  const isEligible = (socialProfile.followersCount ?? 0) >= 200
  if (!isEligible) {
    logger.warn({ postId: post.id, followers: socialProfile.followersCount }, '[PublishOrchestrator] Trial reel ineligible — publishing as reel')
    await prisma.post.update({ where: { id: post.id }, data: { format: 'reel' } })
    result = await publishReel(...)
    break
  }
  // ... normal trial reel flow
}
```

This replaces the reactive 2207081 fallback with a proactive check, while keeping the 2207081 fallback as a safety net.

---

## Implementation Order

1. `api`: Migration + schema for `followersCount` / `followersCountUpdatedAt` on `SocialProfile`
2. `api`: Sync on OAuth connect; add to daily token-refresh job
3. `api`: Expose in `GET /social-profiles` response
4. `flownau`: Proactive guard in `PublishOrchestrator`
5. `app`: UI: disable/warn `trial_reel` format option when ineligible

## Notes

- The 200 follower threshold is Instagram's current policy — store it as a named constant, not a magic number, so it can be updated if Meta changes it.
- Follower counts change slowly; daily sync is sufficient.
- The reactive 2207081 fallback in `PublishOrchestrator` should remain even after this is implemented, as a safety net for stale counts.
