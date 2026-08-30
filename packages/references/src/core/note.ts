import { NoteSchema, type Attachment, type NoteProperties } from './schemas';

/**
 * The rule for what a valid note is, independent of how it gets stored.
 *
 * This is the piece an offline capture needs to run before it ever reaches
 * an api — a note built on a device with no server relationship needs the
 * same answer, not a second implementation of it that happens to agree
 * today. What this deliberately does not do: persist anything, know what a
 * workspace is, or know what Prisma is.
 */
export class InvalidNoteError extends Error {}

export interface NewNoteInput {
  title?: string | null;
  content?: string;
  attachments?: Attachment[];
  suggestedType?: string | null;
}

/**
 * Builds the properties of a brand-new note.
 *
 * At least one of `content` or `attachments` must carry something — an empty
 * note with nothing in it is not a capture, it is nothing. Title alone does
 * not satisfy this: a title with no body or attachment is still empty from
 * the reader's side.
 */
export function buildNewNote(input: NewNoteInput): NoteProperties {
  const title = input.title?.trim() || null;
  const content = input.content?.trim() ?? '';
  const attachments = input.attachments ?? [];

  if (!content && attachments.length === 0) {
    throw new InvalidNoteError('a note needs content or at least one attachment');
  }

  return parse({
    title,
    content,
    attachments,
    suggestedType: input.suggestedType ?? null,
  });
}

export interface NoteEditInput {
  /** The note's current stored properties. */
  current: NoteProperties;
  title?: string | null;
  content?: string;
  attachments?: Attachment[];
}

/**
 * Applies a human edit to an existing note.
 *
 * Only the fields supplied change; omitted fields keep their current value.
 * `suggestedType` is never touched by an edit — it is cleared only by
 * `order` (per nau#111), which is a distinct act from editing content.
 */
export function applyNoteEdit(input: NoteEditInput): NoteProperties {
  const next = {
    ...input.current,
    ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
    ...(input.content !== undefined ? { content: input.content.trim() } : {}),
    ...(input.attachments !== undefined ? { attachments: input.attachments } : {}),
  };

  if (!next.content && (next.attachments as Attachment[]).length === 0) {
    throw new InvalidNoteError('a note needs content or at least one attachment');
  }

  return parse(next);
}

/**
 * Clears `suggestedType` once a note has been ordered — confirmed as one
 * kind (its own, or a foreign one via a `type` mutation elsewhere) rather
 * than merely suggested. Per nau#111, ordering into a foreign kind is a
 * mutation of the block's own `type`, done at the persistence boundary; this
 * function only clears the property that stops making sense once that
 * happens.
 */
export function clearSuggestion(current: NoteProperties): NoteProperties {
  return parse({ ...current, suggestedType: null });
}

function parse(candidate: unknown): NoteProperties {
  const result = NoteSchema.safeParse(candidate);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new InvalidNoteError(`Invalid note — ${detail}`);
  }
  return result.data;
}
