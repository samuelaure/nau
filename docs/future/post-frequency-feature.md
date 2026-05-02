# Post Frequency Feature — Scheduling, Slot Assignment & Auto-Generation

## Status: Partially implemented

`PostSchedule` and `PostSlot` models exist in flownau schema. Format chain, daily frequency, and time window fields are in place. Full auto-generation trigger loop and slot materialization service are pending.

---

## Overview

The post frequency feature is the scheduling engine of flownau. It replaces the manual scheduling approach with a rule-driven system: the user defines *how* they want to post, and the system fills slots automatically from approved ideas — generating new ones when supply runs low.

---

## Four user-facing configurations

### 1. Format chain
An ordered list of formats that repeats cyclically. Defines the *variety pattern* of posts — not dates, not times, just order.

```
Example: [reel, carousel, reel, trial_reel, head_talk, reel, carousel, static_post, story, trial_reel]
```

- As long as the user wants (10, 20, 50 items)
- Repeats from position 0 after the last position is consumed
- Stored as `String[]` on a `PostSchedule` model (see below)

### 2. Daily posting frequency
How many posts per day. Combined with the format chain, determines how fast the chain advances.

```
Example: chain length = 10, daily frequency = 3 → chain repeats every ~3.3 days
```

### 3. Time window
A start time and end time applied to every day. Posts are distributed evenly within the window.

```
First post   = window start
Spacing      = (window end − window start) / (daily frequency − 1)
Last post    = window end
```

If daily frequency = 1, the single post goes at window start.

### 4. Coverage horizon (Brand setting)
How many days of scheduled + approved content the brand wants to have ready at all times. After every successful publish, the system checks whether coverage still meets this threshold.

```
Example: horizon = 7 days → at all times, 7 days of content must be planned ahead
```

---

## Data model

```prisma
model PostSchedule {
  id             String   @id @default(cuid())
  brandId        String   @unique
  formatChain    String[]             // ordered format list, repeating
  dailyFrequency Int      @default(1)
  windowStart    String               // "HH:MM" in brand timezone
  windowEnd      String               // "HH:MM" in brand timezone
  timezone       String   @default("UTC")
  chainPosition  Int      @default(0) // tracks position in formatChain
  isActive       Boolean  @default(true)
  updatedAt      DateTime @updatedAt

  brand Brand @relation(fields: [brandId], references: [id], onDelete: Cascade)
}
```

`Brand.coverageHorizonDays Int @default(7)` — added to Brand model.

---

## Slot materialization

Slots are concrete scheduled datetimes generated from the PostSchedule. They are materialized on demand (when the after-publish check runs, or when the user opens the calendar view).

```
function materializeSlots(brandId, daysAhead):
  1. Load PostSchedule for brand
  2. For each day in [today, today + daysAhead]:
       For each post index in [0, dailyFrequency):
         scheduledAt = windowStart + index * spacing
         format = formatChain[(chainPosition + totalSlotIndex) % chainChain.length]
         Create PostSlot { brandId, scheduledAt, format, status: 'empty' }
  3. Advance chainPosition by (daysAhead * dailyFrequency) % chainLength
```

A `PostSlot` is a lightweight record:

```prisma
model PostSlot {
  id           String    @id @default(cuid())
  brandId      String
  scheduledAt  DateTime
  format       String
  postId       String?   @unique   // null = unfilled
  status       String    @default("empty")  // empty | filled | published

  brand Brand @relation(fields: [brandId], references: [id], onDelete: Cascade)
  post  Post? @relation(fields: [postId], references: [id])
}
```

---

## After-publish trigger (the main loop)

Runs after every successful `PUBLISHED` transition on a `Post`.

```
1. Count slots with scheduledAt between now and (now + coverageHorizonDays)
   that are still empty.

2. If empty slots == 0 → done.

3. For each empty slot (ordered by scheduledAt asc):
   a. Find an IDEA_APPROVED Post whose format matches (or is null — format not yet assigned)
      AND whose generationBatchId satisfies the interleaving rule.
   b. If found:
      - Assign: post.scheduledAt = slot.scheduledAt, post.format = slot.format,
        post.status = SCHEDULED, slot.status = filled
   c. If not found (no valid ideas):
      - Trigger idea generation (see below)
      - Break loop (generation is async; loop resumes after ideas arrive)

4. Persist all slot updates.
```

---

## Interleaving enforcement (≥2 rule)

When selecting the next `IDEA_APPROVED` post for a slot, the selector checks:

```
recentlyScheduled = last 2 Posts assigned to slots (by scheduledAt desc)
candidateBatchId  = candidate.generationBatchId

ALLOW if:
  - candidateBatchId is null (manual idea — always allowed)
  - OR none of recentlyScheduled have the same generationBatchId as candidate

BLOCK if:
  - Any of the last 2 scheduled posts share the same generationBatchId
```

If all available `IDEA_APPROVED` posts are blocked by the rule → trigger idea generation.

---

## Auto-generation trigger

When the after-publish loop cannot fill a slot (no valid ideas), it:

1. Calls nauthenticity to fetch a topic (the current digest/synthesis).
2. If topic is available:
   - Determines how many ideas needed: `emptySlots × 1.5` (buffer), split across `ceil(needed / ideationCount)` batches.
   - Fires that many ideation requests (each becomes a separate `generationBatchId`).
3. If topic is unavailable (nauthenticity returns nothing):
   - Does NOT block publishing.
   - Sends a notification to the user (Zazŭ / in-app) explaining:
     - How many slots are uncovered
     - Three options: generate manually in flownau, capture in Zazŭ, add to InspoBase

---

## Dependencies

- `Post` model with `generationBatchId`, `status`, `format`, `scheduledAt`
- `Brand.coverageHorizonDays`
- `Brand.autoApproveIdeas`
- Simplified ideation service (current sprint — done)
- nauthenticity topic API (see `nauthenticity-post-sync.md`)

## Priority: After Post model refactor + composer format expansion
