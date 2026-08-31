import type { BlockKind } from '../core/kinds/kind.contract';
import {
  JournalEntrySchema,
  JournalSynthesisSchema,
  JOURNAL_ENTRY_KIND,
  JOURNAL_SYNTHESIS_KIND,
  JOURNAL_ENTRY_CAPABILITIES,
  JOURNAL_SYNTHESIS_CAPABILITIES,
  type JournalEntryProperties,
  type JournalSynthesisProperties,
} from '@nau/journal';

/**
 * What Journal contributes to the running system.
 *
 * These are the first kinds registered against the core registry, and the point
 * at which the registry stops being a mechanism with nothing in it. Deleting
 * this folder unregisters them: the core does not change, the database schema
 * does not change, and there is no migration to write.
 *
 * The schema and the capabilities are Journal's domain rules, defined in
 * `@nau/journal` (nau#96) — a package with no dependency on this api, so the
 * same rules can validate a capture on a device that never reaches this file.
 * What is api-shaped, and stays here, is the registration itself: wiring
 * those rules into `core/kinds`, and declaring which fields become projected
 * columns — a decision about this database, not about what an entry means.
 */

export const journalEntryKind: BlockKind<JournalEntryProperties> = {
  id: JOURNAL_ENTRY_KIND,
  schema: JournalEntrySchema,
  capabilities: JOURNAL_ENTRY_CAPABILITIES,
  /**
   * `date` is what every read filters and orders by — it is the field Time
   * reached for in raw SQL before that coupling was cut (nau#63). Projecting it
   * makes that query typed and indexed instead of a cast against unindexed JSON.
   *
   * The column itself arrives with the coordinated deploy; declaring it here is
   * what tells the migration which columns to generate.
   */
  projections: [{ property: 'date', type: 'timestamptz' }],
};

export const journalSynthesisKind: BlockKind<JournalSynthesisProperties> = {
  id: JOURNAL_SYNTHESIS_KIND,
  schema: JournalSynthesisSchema,
  capabilities: JOURNAL_SYNTHESIS_CAPABILITIES,
  /**
   * A synthesis is found by the period it covers, which is the pair Time asks
   * for when composing a larger period from smaller ones.
   */
  projections: [
    { property: 'from', type: 'timestamptz' },
    { property: 'to', type: 'timestamptz' },
  ],
};

export const JOURNAL_KINDS = [journalEntryKind, journalSynthesisKind] as const;
