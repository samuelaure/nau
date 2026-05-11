# Cross-Brand De-Duplication

> Partially implemented. Core dedup is in place. Two open items documented below.

## Why

As we grow, multiple brands will inevitably share profiles/posts:
- Brand A monitors a profile that is Brand B's owned profile.
- Two brands have the same profile in their Comment / InspoBase / Benchmark-Study categories.
- Many brands capture the same post.

We must avoid triplicating:
- **Storage** (rows, media, transcripts)
- **Compute** (downloads, embeddings, transcriptions)
- **Third-party costs** (Apify, OpenAI, etc.)

## Design

Profile/post records are **shared singletons** keyed by a stable external ID. Category membership
and brand association are separate join records (`CategoryMembership`).

```
SocialProfile (singleton per Instagram account)
    ↑ socialProfileId
Post (singleton per Instagram post)  ──→ CategoryMembership(brand-1, profileId, INSPO)
                                    ──→ CategoryMembership(brand-2, postId,    INSPO)
```

## What is implemented

- `SocialProfile` is `@@unique([platform, username])` — shared globally across all brands.
- `Post` is `url @unique` + `platformId @unique` — shared globally.
- `CategoryMembership` is the join record — one row per (owner × profile/post × category).
- Ingester does `post.upsert({ where: { url } })` — never creates a duplicate post.
- Media download and compute (transcription, embedding) are skipped if already processed.
- `POST /capture-post` endpoint: when a brand captures a post that already exists and is fully
  processed, only a `CategoryMembership` row is created — zero Apify / compute cost.
- Fanout (COMMENT profiles): batches all brand targets into one Apify call per unique username.

---

## Open item 1 — Redundant post-level memberships after profile add

### The scenario

Brand-2 captures a specific post from @johndoe and stores it as
`CategoryMembership(brand-2, postId=post-xyz, INSPO)`.

Later, Brand-2 adds @johndoe's full profile to INSPO:
`CategoryMembership(brand-2, socialProfileId=sp-johndoe, INSPO)`.

At this point the post-level membership is **redundant** — Brand-2 already sees `post-xyz` via
the profile membership (all posts where `Post.socialProfileId = sp-johndoe`).

### Current behavior
Both memberships coexist. No duplicate data or compute — it's harmless. But it's noise in the DB
and could cause double-counting in future analytics.

### Fix (simple — implement when it causes a real problem)

In `IntelligenceService.createProfileMemberships`, after creating the profile-level membership,
delete any post-level memberships for the same owner + category where the post belongs to that
profile:

```typescript
await this.prisma.categoryMembership.deleteMany({
  where: {
    ...ownerField,
    category: opts.category,
    socialProfileId: null,
    post: { socialProfileId: profile.id },
  },
})
```

**Implemented:** yes — added in `intelligence.service.ts` `createProfileMemberships`.

---

## Open item 2 — SocialProfile dedup must use Instagram's stable numeric ID, not username

### The problem

Usernames on Instagram are mutable. If @johndoe renames to @newjohndoe, the current
`@@unique([platform, username])` constraint would create a second `SocialProfile` row instead of
finding the existing one. This breaks the singleton guarantee.

The same risk exists for posts: `Post.url` can theoretically change (CDN path, URL format updates),
but `Post.platformId` (Instagram's numeric post ID) is permanent.

### The fix

#### SocialProfile — add `externalId`

Add `externalId String?` to `SocialProfile`. When scraping, always store Instagram's numeric
profile ID here. Upsert logic:

1. If `externalId` is known → find by `(platform, externalId)` first. If found, update `username`
   (handles renames). If not found, create with both `username` and `externalId`.
2. If `externalId` not yet known (user manually added by username before first scrape) →
   fall back to `(platform, username)` upsert as before, populate `externalId` on first scrape.

```sql
ALTER TABLE "SocialProfile" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "SocialProfile_platform_externalId_key"
  ON "SocialProfile"("platform", "externalId")
  WHERE "externalId" IS NOT NULL;
```

#### Post — enforce `platformId`

`Post.platformId` (Instagram's numeric post ID) is already in the schema and `@unique`, but
nullable. The ingester should always populate it from `item.id` / `item.shortcode`, and the
upsert should prefer `platformId` as the primary lookup key over `url`.

### Data sources (Apify)

| Stable field | Where it comes from |
|---|---|
| `NauIGProfile.id` | Returned by `runUniversalInstagramScraper` → `profile.id` |
| `NauIGPost.author.id` | Every scraped post carries `author.id` — the profile's numeric ID |
| `NauIGPost.id` | Instagram's numeric post ID (maps to `Post.platformId`) |
| `NauIGPost.shortcode` | Also stable — the `p/{shortcode}` in the URL |

**Implemented:** yes — `SocialProfile.externalId` added, ingester and fanout updated to use it.
