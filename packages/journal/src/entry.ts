import { JournalEntrySchema, type JournalEntryProperties, type JournalOriginFormat, type JournalSource } from './schemas';

/**
 * The rule for what a valid journal entry is, independent of how it gets
 * stored.
 *
 * This is the piece an offline capture needs to run before it ever reaches
 * the API: whether a piece of text and its metadata make a valid entry is a
 * question with one answer, and a device that captures a diary entry while
 * disconnected needs that same answer, not a second implementation of it that
 * happens to agree today.
 *
 * What this deliberately does not do: persist anything, know what a
 * workspace is, or know what Prisma is. `relations/api-journal/`
 * (`apps/api`) is what writes the result; this only decides what the result
 * should look like.
 */
export class InvalidJournalEntryError extends Error {}

export interface NewJournalEntryInput {
  text: string;
  date?: string;
  source: JournalSource;
  originFormat: JournalOriginFormat;
  sourceId?: string;
}

/**
 * Builds the properties of a brand-new entry.
 *
 * `text` and `textOriginal` start identical — the split only matters once a
 * human edits the entry, which cannot have happened yet. `date` defaults to
 * now only when the caller has no better answer; a capture pipeline that
 * knows when something was actually said should always supply it, since a
 * note spoken at 23:50 and processed at 00:05 belongs to the day it was
 * spoken.
 */
export function buildNewEntry(input: NewJournalEntryInput): JournalEntryProperties {
  const text = input.text?.trim();
  if (!text) throw new InvalidJournalEntryError('text is required');

  const candidate = {
    text,
    textOriginal: text,
    date: input.date ?? new Date().toISOString(),
    source: input.source,
    originFormat: input.originFormat,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
  };

  return parse(candidate);
}

export interface EntryEditInput {
  /** The entry's current stored properties. */
  current: JournalEntryProperties;
  /** The corrected text. */
  text: string;
}

/**
 * Applies a human correction to an existing entry.
 *
 * Only `text` changes. `textOriginal` is never touched — it is the record of
 * what the entry said before this or any earlier edit, and overwriting it
 * would erase the one thing that makes an edit reversible in meaning.
 * `editedAt` is stamped so a synthesis pipeline reading this entry later
 * knows a person, not just a transcription, produced this wording.
 */
export function applyEdit(input: EntryEditInput): JournalEntryProperties {
  const text = input.text?.trim();
  if (!text) throw new InvalidJournalEntryError('text is required');

  return parse({
    ...input.current,
    text,
    editedAt: new Date().toISOString(),
  });
}

export interface ConvertCaptureInput {
  /** Whatever the source block already held, however partial. */
  existing: Record<string, unknown>;
  text?: string;
  date?: string;
  source: JournalSource;
  originFormat: JournalOriginFormat;
}

/**
 * Builds entry properties for a capture that is becoming a journal entry,
 * rather than being created as one from the start.
 *
 * The GTD inbox and the journal are the same substrate conceptually: a
 * capture that turns out to be a diary entry becomes one in place. This
 * function decides what that conversion should look like; whether the block
 * itself is updated or replaced is a persistence decision made elsewhere.
 */
export function buildConvertedEntry(input: ConvertCaptureInput): JournalEntryProperties {
  const text = (input.text ?? (input.existing.text as string) ?? '').trim();
  if (!text) throw new InvalidJournalEntryError('cannot convert a capture with no text');

  const candidate = {
    text,
    textOriginal: (input.existing.textOriginal as string) ?? text,
    date: input.date ?? (input.existing.date as string) ?? new Date().toISOString(),
    source: input.source,
    originFormat: input.originFormat,
    ...(input.existing.sourceId ? { sourceId: input.existing.sourceId as string } : {}),
  };

  return parse(candidate);
}

function parse(candidate: unknown): JournalEntryProperties {
  const result = JournalEntrySchema.safeParse(candidate);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new InvalidJournalEntryError(`Invalid journal entry — ${detail}`);
  }
  return result.data;
}
