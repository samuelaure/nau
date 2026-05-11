# Journal + Experiences Merge

> Planned refactor. Journal and Experiences are currently separate views in app.9nau.com
> with different UI implementations. They serve overlapping purposes and should be unified.

## Current state
- **Journal** (`JournalView.tsx`) — date-based writing view
- **Experiences** — uses the same `NoteGrid` / grouped-by-date pattern as other views, filtered by `type === 'experience'` blocks

## Goal
Merge into a single "Journal" view (or a renamed combined view) that:
- Handles both journal entries and experience blocks
- Presents a unified date-ordered timeline
- Removes the duplicated sidebar entry

## Open questions
- Which name wins: Journal, Experiences, or something new?
- Does the merge happen at the data model level (single block type) or just the UI?
- Any meaningful distinction between a "journal entry" and an "experience" worth preserving as a sub-type?

## Status
- Stand-by. Sidebar keeps both entries for now; merge is its own refactor effort.
