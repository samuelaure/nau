import type { BlockKind } from '../../core/kinds/kind.contract';
import {
  NoteSchema,
  REFERENCES_NOTE_KIND,
  REFERENCES_NOTE_CAPABILITIES,
  type NoteProperties,
} from '@nau/references';

/**
 * What References contributes to the running system.
 *
 * A single kind, per `tmp/references-blueprint.md` §2.1 — a captured
 * Instagram post and a one-line thought are the same shape, title +
 * content + optional attachments, so there is nothing here to enumerate
 * beyond `references.note` itself.
 *
 * The schema and the capabilities are References' domain rules, defined in
 * `@nau/references` — a package with no dependency on this api, so the same
 * rules can validate a capture on a device that never reaches this file.
 * What is api-shaped, and stays here, is the registration itself: wiring
 * those rules into `core/kinds`, and declaring which fields become
 * projected columns — a decision about this database, not about what a note
 * means.
 */

export const referencesNoteKind: BlockKind<NoteProperties> = {
  id: REFERENCES_NOTE_KIND,
  schema: NoteSchema,
  capabilities: REFERENCES_NOTE_CAPABILITIES,
  /**
   * `title` is what search and listing filter and order by — the one field
   * a query needs typed and indexed rather than cast out of JSON (nau#63).
   * `content` and `attachments` stay unprojected: they are rich content, not
   * filter fields, per `tmp/references-blueprint.md` §4.
   *
   * `nextReviewAt` is deliberately absent, even though the 968 migrated
   * `CAPTURE_POST` rows once carried it (nau#77): a note holds no schedule
   * of its own (`@nau/references`' `review-intent.ts`) — the date lives on
   * the referenced Actions item's own `Planning`, which is where
   * `api-actions` projects it.
   */
  projections: [{ property: 'title', type: 'text' }],
};

export const REFERENCES_KINDS = [referencesNoteKind] as const;
