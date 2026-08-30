import type { JournalOriginFormat, JournalSource } from '../../schemas';

/**
 * `(GTD)·(Journal)` — the operation GTD invokes when a tray item is ordered
 * into the diary.
 *
 * **Corrects a scope error from the first draft of this file.** `nau#115`
 * asked to confirm/build the contract for `processJournalOnly`
 * (`apps/api/src/triage/triage.service.ts`, the `journalOnly: true` fast
 * path) — but that fast path is `(Journal)·(Zazŭ)`, not `(GTD)·(Journal)`:
 * it runs when someone picks "Journal" directly in Zazŭ's in-chat form and
 * never touches a tray at all. Confirmed with Samuel (2026-08-30):
 *
 *   - **`(Journal)·(Zazŭ)`** — the fast path. A voice capture goes straight
 *     to the diary with no intermediate block. This is Zazŭ's relation to
 *     build, not this package's.
 *   - **`(GTD)·(Zazŭ)`**, then **`(GTD)·(Journal)`** — what someone picks
 *     "GTD" for in the form: a capture lands as `references.note` in a
 *     tray, gets processed (possibly alongside actions or reference
 *     material in the same note), and *ordering* it into the diary mutates
 *     that note's `type` to `journal.entry` (nau#111) — never creates a
 *     second block.
 *
 * This file is the second one: what GTD calls once it has decided a tray
 * item should become a journal entry. It never builds from scratch and
 * never receives raw capture metadata (`source`/`originFormat` describing
 * *how something was captured*) — that belongs to whichever relation
 * created the note in the first place (`(GTD)·(Zazŭ)` or `(GTD)·(References)`),
 * and is preserved on the note's own properties, not re-supplied here.
 */
export interface OrderIntoJournal {
  /** The block already sitting in a tray, about to become a journal entry. */
  readonly blockId: string;
  /** A correction to the note's text, if GTD's processing step changed it. */
  readonly text?: string;
  /** When it was lived. Falls back to whatever the note already carried. */
  readonly capturedAt?: string;
  /**
   * Present only if the existing note's own `source`/`originFormat` cannot
   * be trusted as-is — e.g. a note assembled from several captures. Absent
   * in the common case: the note already carries this from when it was
   * captured, and `orderIntoJournal` (`order.ts`) reads it from there.
   */
  readonly source?: JournalSource;
  readonly originFormat?: JournalOriginFormat;
}

/**
 * `entryId` is the same id as `OrderIntoJournal.blockId` — ordering mutates
 * the block in place (nau#111), it does not create a new one. Kept as its
 * own field rather than reusing `blockId` so a caller reading only the
 * result doesn't have to know that fact to get the id right.
 */
export interface OrderedIntoJournal {
  readonly entryId: string;
}
