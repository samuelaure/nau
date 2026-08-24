/**
 * What an entry says, and which field to write when it is edited.
 *
 * A journal entry does not have one text field. It has up to three, and which
 * one is authoritative depends on where the entry came from and whether anyone
 * has corrected it since:
 *
 * - `raw` — the capture exactly as it arrived. For a voice note this is the
 *   transcription before any clean-up, which is the only form with no model
 *   standing between the microphone and the diary.
 * - `summary` — the same capture with disfluencies removed. Itself a model
 *   output, so it is the readable form rather than the faithful one.
 * - `text` — what the web capture writes, which has no raw/clean distinction
 *   because a person typed it directly.
 *
 * Every reader in the system has to agree on how those collapse into one
 * string, and until this module existed they did not: the API resolved them in
 * `entryText()`, the journal view had its own copy of the rule, and Home read
 * `properties.text` alone — so every entry captured by voice rendered as a
 * blank row, present in the DOM with nothing in it. That is the bug this file
 * exists to make structurally impossible rather than fixed in three places.
 */

/** The subset of a block this module needs. Deliberately not the full Block. */
export interface EntryLikeProperties {
  raw?: unknown
  summary?: unknown
  text?: unknown
  name?: unknown
  editedAt?: unknown
  [key: string]: unknown
}

export interface EntryLike {
  properties: EntryLikeProperties | null | undefined
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * The faithful text of an entry — what a summary should be built from.
 *
 * Mirrors `JournalService.entryText` on the server, and the two must not drift:
 * a summary built from one form while the screen shows another is a diary that
 * disagrees with itself.
 *
 * A hand-made correction outranks the original capture. If the person opened
 * the entry and fixed it, that is the most authoritative version of what they
 * meant — more so than a transcription of what a microphone heard. `raw` still
 * holds the original either way, so nothing is lost.
 */
export function entryText(entry: EntryLike): string {
  const p = entry.properties
  if (!p) return ''

  if (p.editedAt) return str(p.summary) || str(p.text) || str(p.raw)

  return str(p.raw) || str(p.summary) || str(p.text) || str(p.name)
}

/**
 * The text to put on screen, which is not always the faithful one.
 *
 * Reading is the one place the cleaned form wins: `raw` carries the "eh"s and
 * the false starts, and a diary someone reads back years later should not make
 * them wade through those. The faithful form stays one field away, and the
 * summary generator keeps reading it.
 */
export function displayText(entry: EntryLike): string {
  const p = entry.properties
  if (!p) return ''

  return str(p.summary) || str(p.text) || str(p.raw) || str(p.name)
}

/**
 * Which property an edit should be written to.
 *
 * Writing to `text` unconditionally would strand the correction: nothing that
 * reads an entry looks at `text` when `summary` is present, so the edit would
 * appear to save and then vanish on reload. The rule is to correct the field
 * the entry actually speaks through, and to leave `raw` untouched always —
 * it is the record of what was originally captured.
 */
export function editableField(entry: EntryLike): 'summary' | 'text' {
  const p = entry.properties
  if (!p) return 'text'
  return typeof p.summary === 'string' ? 'summary' : 'text'
}

/**
 * The patch that records one edit.
 *
 * `editedAt` is the flag the summary generator reads to know a human corrected
 * this entry, so it must be stamped by every path that edits one — otherwise
 * the correction is silently outranked by the original transcription the next
 * time a summary is generated.
 */
export function entryEditPatch(entry: EntryLike, next: string): Record<string, unknown> {
  return {
    [editableField(entry)]: next,
    editedAt: new Date().toISOString(),
  }
}
