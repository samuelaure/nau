# Actions → GTD: smart capture with a confirmation step

> **Migrated to [nau#5](https://github.com/samuelaure/nau/issues/5) on 2026-08-26.** This document
> is kept as the full design writeup — the issue summarizes it and is where status/priority live
> going forward. Update the issue, not this file, when the state changes.

## Rename

"Tareas" (Actions/Tasks) is the wrong name for what this module does or should do. **"GTD"** is
closer — the purpose is identifying, separating and distributing varied captures across naŭ's
GTD-structured platform, not just tasks. A better final name is still pending; GTD is the working
label until one is found.

## New categories

Today the triage prompt classifies into 6 GTD-native categories: `action`, `project`, `habit`,
`appointment`, `someday_maybe`, `reference`. Add two more, now that the module's real purpose is
clearer:

- **Journal** — a capture that is actually a journal entry, misfiled into this pipeline (or
  deliberately sent here because the person didn't pre-select an intent).
- **Capture** — a catch-all for anything that doesn't cleanly fit a GTD bucket, still worth
  keeping rather than discarding.

## Confirmation step (the actual design change)

The current pipeline writes classified segments straight to their block type — the model decides,
and the decision is final the moment it's saved. That skips the part of GTD that actually matters:
**clarify, then decide** is two steps, not one.

New flow:

1. Capture arrives (voice or text), gets classified by the model as today — but the segments are
   **not yet actions/projects/habits/journal entries**. They land in a pending/inbox state, GTD's
   own "process this" step, visible in the UI as items awaiting confirmation.
2. Person reviews each one: confirms ("yes, this is an action"), or **edits** the text/category
   before confirming, or discards it.
3. Only on confirmation does the item become the real thing — an `action` block, a `project` with
   its sub-actions, a `habit`, a `journal_entry`.

This makes the module "smart capture with pre-processing as assistance," not an autonomous
classifier. The model saves time; the person still owns the decision — which is also the GTD
model's actual point, and the current one-shot write skips it.

## Scope note

This is Actions-module work, deliberately not touched while journal work is in progress. Revisit
when Actions/GTD is next worked on directly.
