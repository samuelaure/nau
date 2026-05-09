# Feature Exploration: Follower-Only Posting via Trial Reel Auto-Graduation

## Background

Instagram's Trial Reels API supports a `graduation_strategy` parameter inside `trial_params`. Currently the pipeline uses `MANUAL` (safe default — trial stays non-follower until manually promoted). The `SS_PERFORMANCE` strategy unlocks a fully automated graduation flow.

## What `SS_PERFORMANCE` Does

When a trial reel is published with `graduation_strategy: "SS_PERFORMANCE"`, Instagram:
1. Shows the reel to a sample of **non-followers** for a test period (typically 24–72h)
2. Measures performance metrics (views, likes, shares, saves) against a threshold
3. If performance qualifies → automatically graduates the reel to the creator's **full follower audience**
4. If performance does not qualify → reel remains visible to non-followers only (or expires)

This is essentially a built-in A/B test with automatic promotion — zero manual intervention.

## Proposed Feature: Per-Brand Graduation Strategy Config

### Goal

Allow each Brand to configure its trial reel graduation behavior independently:
- Some brands may want manual control over what reaches followers
- Others may want full automation (best for 24/7 pipeline)

### Schema Change

Add `trialReelGraduationStrategy` to the `Brand` table in `apps/api`:

```sql
ALTER TABLE "Brand" ADD COLUMN "trialReelGraduationStrategy" TEXT NOT NULL DEFAULT 'MANUAL';
-- Valid values: 'MANUAL' | 'SS_PERFORMANCE'
```

Expose via the brand settings UI in `apps/app`.

### Pipeline Flow

```
PublishOrchestrator (flownau)
  → fetchBrandSettings (via @nau/sdk → api)
  → publishTrialReel({ ..., graduationStrategy: brand.trialReelGraduationStrategy })
```

The `TrialReelPublishParams.graduationStrategy` field already accepts both values — only the data source changes.

### Monitoring Hook (Future)

When `SS_PERFORMANCE` is used, Instagram may send webhook events when graduation occurs. A future nauthenticity ingestion job could:
- Listen for `REEL_TRIAL_STATUS_UPDATE` webhook events
- Log the graduation outcome against the post record
- Feed the result into brand performance analytics

## Implementation Checklist

- [ ] `api`: Add `trialReelGraduationStrategy` column to `Brand` (migration, schema, DTO)
- [ ] `api`: Expose via `GET /brands/:id` response and `PATCH /brands/:id` endpoint
- [ ] `app`: Add graduation strategy toggle in brand content settings UI
- [ ] `flownau`: `PublishOrchestrator` fetches strategy from brand settings via SDK before publishing trial reels
- [ ] `flownau`: Remove hardcoded `'MANUAL'` default once brand setting is available
- [ ] `nauthenticity` (stretch): Ingest `REEL_TRIAL_STATUS_UPDATE` webhooks and log graduation outcomes

## References

- [Meta: Publish Content — Trial Reels](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [Meta: IG User Media endpoint — trial_params](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/)
