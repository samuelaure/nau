import { buildConvertedEntry, InvalidJournalEntryError } from '../../entry';
import type { OrderIntoJournal } from './contract';
import type { JournalEntryProperties } from '../../schemas';

/**
 * Executes `OrderIntoJournal`: builds the properties the mutated block
 * should carry once GTD orders a tray item into the diary.
 *
 * Takes the note's own existing properties rather than reading anything
 * itself — this package has no persistence layer (see `../../entry.ts`).
 * The caller (GTD's own `(GTD)·(Journal)` relation, or `apps/api` on its
 * behalf) is what reads the block and writes the result back with its
 * `type` changed to `journal.entry` — this function only decides the shape.
 *
 * `source`/`originFormat` are read from the existing note when
 * `OrderIntoJournal` doesn't override them — a note already carries how it
 * was captured (nau#111: the note existed with its full contract from the
 * first instant), and re-deriving that here would be a second opinion on a
 * fact GTD's other relations already settled. Missing entirely only when
 * the note predates that guarantee or was assembled by hand; that is a data
 * problem for the caller to have prevented, not something this function
 * guesses at — it throws rather than defaulting to a made-up source.
 */
export function orderIntoJournal(
  order: OrderIntoJournal,
  existing: Record<string, unknown>,
): JournalEntryProperties {
  const source = order.source ?? (existing.source as JournalEntryProperties['source']);
  const originFormat =
    order.originFormat ?? (existing.originFormat as JournalEntryProperties['originFormat']);

  if (!source || !originFormat) {
    throw new InvalidJournalEntryError(
      `cannot order block ${order.blockId} into the journal — neither the order nor the existing note carries source/originFormat`,
    );
  }

  return buildConvertedEntry({
    existing,
    ...(order.text !== undefined ? { text: order.text } : {}),
    ...(order.capturedAt !== undefined ? { date: order.capturedAt } : {}),
    source,
    originFormat,
  });
}
