/**
 * What an entry says, and what to write when it is edited.
 *
 * This module used to reconcile three fields — `raw`, `summary` and `text` —
 * because an entry's authoritative text depended on where it came from and
 * whether anyone had corrected it since. Readers disagreed about that rule: the
 * API had one copy, the journal view another, and Home read `properties.text`
 * alone, so every voice-captured entry rendered as a blank row.
 *
 * An entry now holds one field. `text` is what it says; `textOriginal` is what
 * it said before anyone edited it, and nothing reads it to display or interpret
 * an entry. The functions below stay because callers use them and because a
 * single place to ask "what does this entry say" is still worth having — but
 * there is no longer a rule to get wrong.
 */

/** The subset of a block this module needs. Deliberately not the full Block. */
export interface EntryLikeProperties {
  text?: unknown
  textOriginal?: unknown
  editedAt?: unknown
  [key: string]: unknown
}

export interface EntryLike {
  properties: EntryLikeProperties | null | undefined
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

/** What the entry says. */
export function entryText(entry: EntryLike): string {
  return str(entry.properties?.text)
}

/**
 * What to put on screen.
 *
 * Identical to `entryText` now, and kept as a separate name because the two
 * asked different questions when an entry had a faithful form and a readable
 * one. Callers that mean "display this" still read better saying so.
 */
export function displayText(entry: EntryLike): string {
  return entryText(entry)
}

/**
 * The patch that records one edit.
 *
 * `textOriginal` is never touched: it is what the entry said before any human
 * correction, and an edit that overwrote it would erase the only evidence that
 * the entry was changed at all.
 */
export function entryEditPatch(_entry: EntryLike, next: string): Record<string, unknown> {
  return {
    text: next,
    editedAt: new Date().toISOString(),
  }
}
