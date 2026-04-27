# Calendar Posting Goals — Format Slot Auto-Assignment

## Status: Planned (depends on content-piece-pipeline.md)

---

## Concept

The user defines a posting goal from the Calendar — a daily and/or weekly target expressed as a sequence of formats (e.g. "Mon: reel, Wed: carousel, Fri: reel, reel"). These goals create ordered format slots. When ideas are generated, the system assigns a format to each new piece by filling the next available slot in chronological order.

The user retains full control: the assigned format is a suggestion, and an inline dropdown lets them override it at any point.

---

## Models

### PostingGoal

The brand's recurring posting intent. Editable from brand settings or calendar.

```prisma
model PostingGoal {
  id        String   @id @default(cuid())
  brandId   String
  weekday   Int      // 0=Sunday … 6=Saturday
  format    String   // reel | carousel | head_talk | story | static_post | trial_reel
  slotOrder Int      // position within the day if multiple posts planned
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  brand Brand @relation(fields: [brandId], references: [id], onDelete: Cascade)
}
```

### PostingSlot (materialised from goal)

Concrete dated slots generated from the goal, ahead of time (e.g. rolling 4-week window). A `ContentPiece` claims a slot when it reaches `SCHEDULED` status.

```prisma
model PostingSlot {
  id            String    @id @default(cuid())
  brandId       String
  format        String
  scheduledDate DateTime
  slotOrder     Int
  contentPieceId String?  @unique  // null = unfilled

  brand         Brand         @relation(fields: [brandId], references: [id], onDelete: Cascade)
  contentPiece  ContentPiece? @relation(fields: [contentPieceId], references: [id])
}
```

---

## Format assignment logic

When a batch of `ContentPiece` records is created (any origin):

1. Fetch the brand's next N unfilled `PostingSlot` records ordered by `scheduledDate ASC, slotOrder ASC`
2. For each new piece, pop the first unfilled slot and assign:
   - `ContentPiece.format = slot.format`
   - `ContentPiece.scheduledAt = slot.scheduledDate` (tentative — user can move)
   - `PostingSlot.contentPieceId = piece.id`
3. If fewer slots than pieces, remaining pieces get format = `reel` (default) with no date

**Reassignment:** If the user changes a piece's format via the inline dropdown, the slot's format is NOT updated — the slot reflects the goal, the piece reflects reality.

**Slot generation:** A background job (or on-demand when calendar opens) materialises slots for the next 28 days from the active `PostingGoal` records.

---

## UI touchpoints

- **Calendar view** — visualises slots (filled = piece, unfilled = placeholder by format)
- **Idea card** — inline format dropdown (changes piece format, not slot)
- **Brand settings / Calendar settings** — define the weekly posting goal (days + formats)

---

## Calendar slot materialisation

```typescript
async function materialiseSlots(brandId: string, daysAhead = 28) {
  const goals = await prisma.postingGoal.findMany({ where: { brandId, isActive: true } })
  const today = startOfDay(new Date())
  const horizon = addDays(today, daysAhead)

  for (let d = today; d <= horizon; d = addDays(d, 1)) {
    const weekday = d.getDay()
    const dayGoals = goals.filter(g => g.weekday === weekday)
      .sort((a, b) => a.slotOrder - b.slotOrder)

    for (const goal of dayGoals) {
      await prisma.postingSlot.upsert({
        where: { brandId_scheduledDate_slotOrder: { brandId, scheduledDate: d, slotOrder: goal.slotOrder } },
        update: {},
        create: { brandId, format: goal.format, scheduledDate: d, slotOrder: goal.slotOrder }
      })
    }
  }
}
```

---

## Dependencies

- Requires `ContentPiece` model from `content-piece-pipeline.md`
- Calendar UI (new feature surface, not yet designed)

---

## Priority: After ContentPiece refactor
