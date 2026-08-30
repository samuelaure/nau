import { z } from 'zod';

/**
 * References' published contract, enforced at runtime.
 *
 * A TS type is erased at exactly the boundary where the guarantee is needed —
 * the write to a JSON column — so the shape is declared here and checked on
 * every write, not just assumed from a TypeScript interface.
 *
 * `.passthrough()` on the note schema is deliberate, same reasoning as
 * `@nau/journal`'s: `sortOrder` is stamped by the substrate for every kind,
 * so it appears in stored properties without being any kind's business
 * (nau#85). Rejecting it here would make a substrate-managed key fail its
 * owner's validation.
 */

/**
 * What an attachment is, agnostic of where it came from.
 *
 * One kind covers both a file References itself hosts (an image dropped into
 * a note, uploaded to R2 through a presigned URL — the private bucket
 * pattern `@nau/journal`'s voice captures already use) and a link to
 * something external. `metadata` is intentionally untyped further than
 * `Record<string, unknown>`: an Instagram capture's caption/author and a
 * plain image's dimensions have nothing in common, and inventing a shared
 * shape for them would be exactly the kind of central vocabulary #57 warns
 * against. Each producer of an attachment (a relation, or `nau-mobile`) owns
 * what it puts in `metadata`; References never branches on its contents.
 */
export const AttachmentKindSchema = z.enum(['image', 'video', 'file', 'link']);
export type AttachmentKind = z.infer<typeof AttachmentKindSchema>;

export const AttachmentSchema = z.object({
  kind: AttachmentKindSchema,
  /** R2 (own storage) or an external URL. References does not distinguish. */
  url: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable().default(null),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

/**
 * A note: title, content, adjuntos opcionales. The single kind References
 * registers — see `tmp/references-blueprint.md` §2.1 for why a captured
 * Instagram post and a one-line thought are the same shape rather than two
 * kinds. `title` is optional because most captures never carry one; `content`
 * may be empty when a note is nothing but attachments.
 */
export const NoteSchema = z
  .object({
    title: z.string().nullable().default(null),
    content: z.string().default(''),
    attachments: z.array(AttachmentSchema).default([]),
    /**
     * The pre-typing GTD's triage suggests while a note still sits in a
     * tray, per nau#111/nau#112. Never authoritative — `order` is what turns
     * a suggestion into a real kind change (a mutation of the block's own
     * `type`, never a second record). Cleared once the note is ordered;
     * present only while it is still in transit.
     */
    suggestedType: z.string().nullable().default(null),
  })
  .passthrough();

export type NoteProperties = z.infer<typeof NoteSchema>;

/** The kind id References owns. Namespaced, so the owner is part of the identity. */
export const REFERENCES_NOTE_KIND = 'references.note';
