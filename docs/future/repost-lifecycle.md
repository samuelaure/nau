# Repost Lifecycle (flownaŭ — "Posts to Repost")

> Stand-by feature. Modal entry ("Queue Repost") already exists as a placeholder — keep it visible to not forget.
> Out of scope of the source-concepts-and-knowledge-bases plan.

## What it is
For brands whose content strategy includes reposting other creators' content with permission.

## Modal entry
**"Queue Repost"** in the naŭ Mobile App capture modal. Keep as placeholder even before the lifecycle is fully implemented.

## Lifecycle
1. User captures a post via "Queue Repost".
2. Capture lands in a new flownaŭ section below "Unscheduled posts" called **"Posts to Repost"**.
3. System generates a permission-request comment (LLM-assisted), or uses the **user's predefined generic comment**, asking the original author for repost permission.
4. User confirms when the comment was sent.
5. System prompts the user at increasing intervals to check whether permission was granted.
6. If no response by a configurable limit → discard.
7. Once author approves, the user may modify the caption (LLM-assisted or fully manual) and schedule the repost on its target slot.

## Open details (TBD)
- Default check-in intervals (e.g., 24h, 72h, 7d?).
- Discard limit policy.
- Per-brand "predefined generic comment" storage location.
- Whether the system can detect a reply automatically vs requires user confirmation.

## Status
- Stand-by. Modal placeholder exists. Lifecycle not implemented.
- Will be tackled after the source-concepts-and-knowledge-bases plan lands.
