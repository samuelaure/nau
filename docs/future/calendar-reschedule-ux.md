# Feature Plan: Calendar Reschedule UX

Two related improvements to post scheduling in the `AccountCalendar` component (`apps/flownau/src/modules/accounts/components/AccountCalendar.tsx`):

1. **Cross-week drag-and-drop** — drag a post chip to a previous/next week
2. **Manual schedule editor in the post modal** — edit `scheduledAt` directly from the modal with a datetime picker

---

## 1. Cross-Week Drag & Drop

### Current behaviour

Posts are draggable within the current week only. `CompositionChip` sets drag state (`postId`, `format`) and drops are handled by `SlotChip` and `BetweenDropZone` — all rendered inside the current week's grid. There's no way to drag a post to a different week without navigating first.

### Proposed UX

While a drag is in progress, show **"Previous week" and "Next week" edge zones** at the left and right edges of the calendar (or above/below the week header). Hovering over an edge zone for ~600ms auto-advances the week in that direction (scroll-trigger pattern). When the user drops onto an empty slot or between-zone in the newly revealed week, the post moves there.

Alternative (simpler): replace the auto-advance with explicit **"← Drop to previous week" / "Drop to next week →"** drop targets that appear at the calendar edges only while dragging. Dropping onto them opens a **week picker modal** where the user selects the target day/slot.

**Recommendation: go with the explicit drop targets + picker** — auto-advance is harder to implement reliably with React state and the 5s polling refresh cycle.

### Implementation

#### State additions

```ts
// Add to existing drag state
type DragState = {
  postId: string
  format: string
  sourceWeekStart: Date   // so we can restore on cancel
}

const [crossWeekPickerOpen, setCrossWeekPickerOpen] = useState(false)
const [pendingCrossWeekPostId, setPendingCrossWeekPostId] = useState<string | null>(null)
const [pendingCrossWeekDirection, setPendingCrossWeekDirection] = useState<'prev' | 'next' | null>(null)
```

#### Edge drop zones

Render two `EdgeWeekDropZone` components alongside the calendar grid, visible only when `dragState !== null`:

```tsx
{dragState && (
  <>
    <EdgeWeekDropZone
      direction="prev"
      onDrop={() => {
        setPendingCrossWeekPostId(dragState.postId)
        setPendingCrossWeekDirection('prev')
        setCrossWeekPickerOpen(true)
      }}
    />
    <EdgeWeekDropZone
      direction="next"
      onDrop={() => {
        setPendingCrossWeekPostId(dragState.postId)
        setPendingCrossWeekDirection('next')
        setCrossWeekPickerOpen(true)
      }}
    />
  </>
)}
```

`EdgeWeekDropZone` is a simple `div` with `onDragOver` / `onDrop` handlers and a visual indicator (arrow + label). Position: sticky left/right panels flanking the week grid, or fixed strips at left/right viewport edges during drag.

#### Cross-week picker modal

A lightweight modal that shows the target week (current ± 1) as a 7-column day picker. Each day column shows existing post count as a hint. User clicks a day; the post is rescheduled to that day at the same time-of-day as its current `scheduledAt` (or noon if unscheduled).

On confirm:
```ts
const targetDate = /* selected day, same time as original scheduledAt */
await fetch(`/api/posts/${pendingCrossWeekPostId}`, {
  method: 'PATCH',
  body: JSON.stringify({ scheduledAt: targetDate.toISOString(), slotId: null, releaseSlot: true }),
})
// Optimistic update: remove post from current compositions list
// Navigate to target week so the post appears in the new view
setWeekStart(targetWeekStart)
fetchCompositions()
```

#### Week navigation on drop confirm

After confirming a cross-week move, advance `weekStart` by ±7 days so the user immediately sees the post in its new position. This uses the existing `setWeekStart` state setter.

#### Files to modify

| File | Change |
|---|---|
| `AccountCalendar.tsx` | Add `EdgeWeekDropZone` component, cross-week state, picker modal, week navigation on confirm |
| No API changes needed | `PATCH /api/posts/[id]` with `scheduledAt` + `releaseSlot: true` already handles this |

---

## 2. Manual Schedule Editor in Post Modal

### Current behaviour

The modal shows the scheduled time (formatted via `fmtDateTime()`) and has a "Schedule" / "Unschedule" option in the "More" dropdown (`···` menu). The schedule picker (`<input type="datetime-local">`) already exists in the modal but is only accessible via the dropdown — it's not immediately visible or editable inline.

### Proposed UX

Make the scheduled time in the modal header **directly clickable / editable**:

- The `scheduledAt` display (e.g. "Fri 9 May · 12:30") becomes a clickable chip
- Clicking it expands an inline `<input type="datetime-local">` pre-filled with the current value
- Confirming updates the post immediately; cancelling restores the original
- An "Unschedule" link appears below the input
- If no `scheduledAt`, show a "Schedule" button that expands the same input

This replaces the current dropdown-hidden flow without removing it (keep the dropdown entry as a shortcut for keyboard users).

### Implementation

#### State

```ts
const [editingSchedule, setEditingSchedule] = useState(false)
const [scheduleInput, setScheduleInput] = useState('')   // datetime-local string
```

#### Inline datetime editor component (inside modal)

```tsx
{editingSchedule ? (
  <div className="flex items-center gap-2">
    <input
      type="datetime-local"
      value={scheduleInput}
      onChange={(e) => setScheduleInput(e.target.value)}
      className="text-sm border rounded px-2 py-1"
    />
    <button onClick={handleSaveSchedule}>Save</button>
    <button onClick={() => setEditingSchedule(false)}>Cancel</button>
    <button onClick={handleUnschedule} className="text-red-500">Unschedule</button>
  </div>
) : (
  <button onClick={() => {
    setScheduleInput(toDatetimeLocalString(composition.scheduledAt))
    setEditingSchedule(true)
  }}>
    {composition.scheduledAt ? fmtDateTime(composition.scheduledAt) : 'Schedule'}
  </button>
)}
```

#### Save handler

```ts
async function handleSaveSchedule() {
  const iso = new Date(scheduleInput).toISOString()
  await fetch(`/api/posts/${composition.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ scheduledAt: iso }),
  })
  setEditingSchedule(false)
  onRefresh()  // existing callback that refreshes the calendar
}
```

#### Helper: `toDatetimeLocalString`

`<input type="datetime-local">` expects `YYYY-MM-DDTHH:MM` in local time. Add a helper:

```ts
function toDatetimeLocalString(date: Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
```

#### Files to modify

| File | Change |
|---|---|
| `AccountCalendar.tsx` | Replace static scheduledAt display in modal with inline editable chip; add `editingSchedule` state and save/unschedule handlers |
| No API changes needed | `PATCH /api/posts/[id]` with `scheduledAt` already supported |

---

## Implementation Order

1. **Manual schedule editor** (modal) — self-contained, low risk, high daily value
2. **Cross-week drag-and-drop** — builds on existing drag system; requires new UI components

## Notes

- Both features use the existing `PATCH /api/posts/[id]` endpoint — no backend changes needed
- The 5s polling refresh (`useEffect` on `compositions`) will pick up changes automatically
- Cross-week drag should set `releaseSlot: true` in the PATCH body to free the post from any named slot it was assigned to
- The `formatsCompatible()` check for reel↔trial_reel swaps doesn't need to change for cross-week moves
