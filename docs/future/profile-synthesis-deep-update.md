# Profile Synthesis — Deep Update (Planned)

## What it is

A **deep update** fully regenerates a `ProfileSynthesis` from scratch by re-ingesting all available post syntheses for a profile, without relying on the current synthesis as a prior. This is distinct from the **soft update** (already implemented), which triggers incrementally when a threshold of new synthesized posts is reached.

## When it's needed

- The profile's content strategy has shifted significantly and old synthesis content misleads downstream ideation.
- The profile has accumulated a large number of new posts (e.g. 200+) since the last deep update.
- Manual admin action from the nauthenticity profile detail view.
- A second, higher threshold `deepUpdateThreshold` on `SocialProfile` is crossed (not yet added to schema).

## Planned implementation

1. **Schema**: Add `SocialProfile.deepUpdateThreshold Int @default(200)` and `ProfileSynthesis.lastDeepUpdateAt DateTime?`.

2. **Trigger candidates**:
   - Manual: `POST /social-profiles/:id/synthesis/deep-update` (admin/user-triggered).
   - Automatic: checked in `triggerProfileSynthesisSoftUpdate` — if `postCount - lastDeepUpdatePostCount >= deepUpdateThreshold`, run deep update instead of soft update.

3. **Generation**: Same as `ProfileSynthesisService.generateForProfile()` but:
   - Loads ALL synthesized posts (no recency limit).
   - Optionally groups them into chunks if post count exceeds context limits (e.g. 500+ posts → summarize in two passes).
   - Sets `lastDeepUpdateAt` on the resulting `ProfileSynthesis`.

4. **History**: Same archiving behaviour as soft update — old synthesis saved to `ProfileSynthesisHistory`.

## Why deferred

The soft-update mechanism (threshold-based, incremental) covers the majority of real-world cases without requiring a context-window management strategy. Deep update adds complexity (chunked prompting, possible multi-step synthesis) that is not yet warranted by usage patterns. Revisit when profiles routinely exceed 200 synthesized posts.
