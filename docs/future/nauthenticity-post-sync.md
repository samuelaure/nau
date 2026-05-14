# Nauthenticity Post Sync — Published Post Injection

## Status: Planned

---

## Overview

After a `Post` in flownau reaches `PUBLISHED` status, its data is pushed to nauthenticity and stored under the brand's owned `SocialProfile`. This closes the content loop: published content becomes part of the brand's corpus, feeding synthesis, intelligence extraction, and future idea generation — without duplicating media files or re-running the download/transcription pipeline unnecessarily.

---

## Why this matters

- Synthesis and creative direction reflect the brand's own published content, not just inspo
- The ideation engine avoids repeating topics that were recently published
- No duplicate media files: flownau stores the video, nauthenticity references it
- No wasted Apify/transcription cost: content is already processed

---

## Current state

The infrastructure partially exists but is broken at the profile linkage step:

- `onPostPublished` in flownau already calls `syncToNauthenticity` → `POST /_service/posts/sync`
- `PostsService.syncPublishedPost` in nauthenticity already receives and creates the `Post` record
- **Root cause of failure**: `SocialProfile.nauthenticityProfileId` is `NULL` in both flownau rows — the sync silently bails at the guard check

---

## Data flow

```
flownau Post (PUBLISHED)
  → onPostPublished() [fire-and-forget]
    → syncToNauthenticity()
      → POST /_service/posts/sync (nauthenticity)
        → Create Post + FlownauPostMeta records
        → For head_talk: enqueue transcription job (reference flownau videoUrl, no copy)
        → For reel: create Transcript from slots text directly
```

---

## Phase 0 — Fix profile linkage (root cause)

Replace the `nauthenticityProfileId` lookup with a **username-based lookup** in nauthenticity.

In `syncToNauthenticity` (flownau `post-published.ts`):
- Change: look up `nauthenticityProfileId` from `brand.socialProfiles`
- To: send `platformUsername` (the Instagram username) in the payload
- Nauthenticity `syncPublishedPost` looks up the `SocialProfile` by `platform=instagram + username`

This removes the cross-service ID dependency entirely. No backfill needed.

Note: matching by Instagram platformId is not viable — flownau stores the Graph API Business Account ID (`17841xxxxxxx`) while nauthenticity stores the legacy public user ID scraped by Apify — different ID types, same account.

---

## Phase 1 — Nauthenticity schema (additive)

Add a separate `FlownauPostMeta` model (1:1 with `Post`) to hold flownau-specific data without polluting the core `Post` model, which is used across scraped profiles, inspo, comments, and source concepts.

```prisma
model FlownauPostMeta {
  id      String  @id @default(uuid())
  postId  String  @unique
  post    Post    @relation(fields: [postId], references: [id], onDelete: Cascade)
  format  String  // reel | head_talk
  isTrial Boolean @default(false)
  content Json?   // reel → { slots: { text1, text2, ... } }
                  // head_talk → { hook, body, cta }
}
```

`Post` itself gains no new fields. All flownau-specific queries join through `FlownauPostMeta`.

---

## Phase 2 — Flownau sync payload

Update `syncToNauthenticity` in `post-published.ts` to send:

```ts
{
  platformUsername: string       // Instagram username of the posting profile
  flownauPostId:    string
  externalPostId:   string | null
  url:              string        // Instagram post URL
  caption:          string | null
  postedAt:         Date
  postSynthesis:    string | null
  format:           string        // reel | head_talk (strip trial_ prefix; use isTrial instead)
  isTrial:          boolean       // derived from format.startsWith('trial_')
  content:          Json | null   // creative.slots for reels; { hook, body, cta } for head_talk
  media: Array<{
    type:         string
    url:          string          // flownau CDN URL — not copied to nauthenticity storage
    thumbnailUrl: string | null
    index:        number
  }>
}
```

The `creative` field is already fetched in the post query — extract `slots` for reels, `{ hook, body, cta }` for head_talk.

---

## Phase 3 — Nauthenticity sync handler

Update `PostsService.syncPublishedPost`:

1. Look up `SocialProfile` by `platform=instagram + username` instead of internal ID
2. Create `Post` record as today (no model changes)
3. Create `FlownauPostMeta` record linked to the post
4. Post-create logic based on format:
   - `head_talk`: enqueue `transcribe-batch` compute job — pass flownau `videoUrl` directly (no file copy to nauthenticity storage)
   - `reel`: if `content.slots` present → create `Transcript` record from concatenated slot texts (no audio job)

---

## Phase 4 — Dashboard: Feed / Trials tabs on owned profile view

In `AccountView.tsx`, for owned profiles only (where `SocialProfile.ownerId` matches the current brand):

- Add two tabs: **Feed** and **Trials**
- Feed: posts where `FlownauPostMeta.isTrial = false` (or no `FlownauPostMeta` — scraped posts)
- Trials: posts where `FlownauPostMeta.isTrial = true`
- Non-owned profile views: no tabs, existing grid unchanged

---

## Creative JSON structure (reference)

From DB observation:

| Format | `creative` shape |
|--------|-----------------|
| `reel` / `trial_reel` | `{ slots: { text1, text2, text3 }, caption, hashtags, brollMood, renderSnapshot }` |
| `head_talk` / `trial_head_talk` | `{ hook, body, cta, caption, hashtags }` |

For nauthenticity: store only `{ slots }` for reels and `{ hook, body, cta }` for head talks — strip rendering metadata.

---

## Dependencies

- flownau publishing flow (already exists)
- nauthenticity `SocialProfile.ownerId` (already exists)
- `Post` model with existing fields (already exists)

## Priority: Medium. Unblocks full content loop and owned profile corpus.
