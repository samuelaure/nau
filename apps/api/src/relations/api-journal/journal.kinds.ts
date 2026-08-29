import type { BlockKind } from '../../core/kinds/kind.contract';
import {
  JournalEntrySchema,
  JournalSynthesisSchema,
  JOURNAL_ENTRY_KIND,
  JOURNAL_SYNTHESIS_KIND,
  type JournalEntryProperties,
  type JournalSynthesisProperties,
} from './journal.schemas';

/**
 * What Journal contributes to the running system.
 *
 * These are the first kinds registered against the core registry, and the point
 * at which the registry stops being a mechanism with nothing in it. Deleting
 * this folder unregisters them: the core does not change, the database schema
 * does not change, and there is no migration to write.
 */

export const journalEntryKind: BlockKind<JournalEntryProperties> = {
  id: JOURNAL_ENTRY_KIND,
  schema: JournalEntrySchema,
  capabilities: {
    /**
     * An entry records what already happened, so it is never *due*. This is the
     * declaration that keeps entries off an agenda without the agenda holding a
     * list of which types to exclude.
     */
    schedulable: false,
    taggable: true,
    /** Entries sync to the mobile client. */
    syncable: true,
    /**
     * An entry is a leaf. Threading replies under an entry would make the
     * capture a container, which is a different product decision than the one
     * this shape encodes.
     */
    nestable: false,
    softDeletable: true,
  },
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
  capabilities: {
    schedulable: false,
    taggable: true,
    /**
     * A synthesis is derived, not captured. Syncing it to a device would ship a
     * copy of something regenerable, and one that changes when its sources do.
     */
    syncable: false,
    nestable: false,
    softDeletable: true,
  },
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
