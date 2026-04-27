# Nauthenticity Post Sync — Published Post Injection

## Status: Planned (depends on Post model refactor + composer format expansion)

---

## Overview

After a `Post` in flownau reaches `PUBLISHED` status, its data should be injected into nauthenticity's `Post` model under the brand's owned `SocialProfile`. This closes the content loop: published content becomes part of the brand's scraped corpus, feeding back into synthesis, intelligence extraction, and future idea generation.

---

## Why this matters

Currently nauthenticity only knows about posts scraped from Instagram. After this feature, flownau-published posts are also present in nauthenticity — which means:
- Synthesis and creative direction reflect the brand's own published content, not just inspo
- The ideation engine avoids repeating topics that were recently published (via `recentContent` in the prompt)
- Performance data (engagement) can eventually be attached to these posts

---

## Data flow

```
flownau Post (PUBLISHED)
  → POST /api/v1/_service/posts/inject (nauthenticity)
    → Create nauthenticity Post record under the brand's SocialProfile
    → Extract intelligence (hook, pillars, CTA, sentiment, summary)
    → Make available in synthesis pipeline
```

---

## Payload sent to nauthenticity

```ts
interface PublishedPostPayload {
  socialProfileUsername: string   // the posting account
  externalPostId:  string         // Instagram post ID
  externalPostUrl: string         // public URL
  caption:         string
  format:          string         // reel | carousel | head_talk | static_post | story
  videoUrl?:       string
  coverUrl?:       string
  publishedAt:     string         // ISO datetime
  flownauPostId:   string         // for deduplication
}
```

---

## Nauthenticity changes needed

1. New internal endpoint: `POST /api/v1/_service/posts/inject`
   - Accepts `PublishedPostPayload`
   - Creates a `Post` record under the matching `SocialProfile`
   - Sets `source: 'flownau'` to distinguish from scraped posts
   - Queues intelligence extraction job

2. `Post` model: add `source String @default("scrape")` field (`scrape | flownau`)

3. Intelligence extraction: same pipeline as scraped posts — runs automatically after injection

4. Synthesis: no changes needed — injected posts appear in the corpus naturally

---

## Flownau changes needed

After `Post.status` transitions to `PUBLISHED`:
- Fire `injectPublishedPost(post)` as a background job
- Handle failure gracefully (log, do not block publishing flow)
- Store `nauthenticityInjected Boolean @default(false)` on `Post` for retry tracking

---

## Topic delivery for auto-generation

As part of this feature, nauthenticity must reliably return a topic when flownau requests one. The topic is the `recentSynthesis.text` for the brand's owned profile. If no synthesis exists yet (brand is new, no scrape has run), nauthenticity returns `null` and flownau falls back to the notification flow.

Endpoint used by flownau: `GET /api/v1/_service/brands/{brandId}/inspo/digest` (already exists).
Contract change: return a `topic: string | null` field explicitly so flownau can distinguish "no data" from "empty string".

---

## Dependencies

- `Post` model with `status`, `externalPostId`, `externalPostUrl`, `caption`, `format`, `publishedAt`
- nauthenticity `SocialProfile.ownerId` (from BrandIntelligence refactor — planned)
- Post publishing flow in flownau (already partially exists via `Composition`)

## Priority: After composer format expansion. Enables full content loop.
