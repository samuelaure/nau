import { ActionItemSchema, type ActionItemProperties } from '../../schemas';
import type { OrderIntoActions } from './contract';

/**
 * Executes `OrderIntoActions`: builds the properties the mutated block
 * should carry once GTD orders a tray item into Actions.
 *
 * Takes the note's own existing properties rather than reading anything
 * itself — this package has no persistence layer, same discipline
 * `core/attention.ts` and `(GTD)·(Journal)`'s `orderIntoJournal` already
 * apply. The caller (GTD's own `(GTD)·(Actions)` relation, or `apps/api` on
 * its behalf) is what reads the block and writes the result back with its
 * `type` changed to `ACTIONS_ITEM_KIND` — this function only decides the
 * shape.
 *
 * `text` falls back to the existing note's own text/content when
 * `OrderIntoActions` doesn't override it. Unlike `orderIntoJournal`, there is
 * no field this function refuses to default and throw over: a note with
 * empty text is a valid — if bare — action, whereas a journal entry with no
 * source is a data-integrity problem. Nothing here should invent a lie by
 * defaulting; `text: ''` is not a lie, it is the honest state of an item
 * someone captured with no words yet.
 *
 * `status` always starts `'todo'`. Ordering is not completing: an item does
 * not arrive into Actions half-done because it took a while to get there.
 *
 * `priority`/`deadline` are the only fields `OrderIntoActions` may set beyond
 * text — the two the current triage already extracts for the `action`
 * category (`triage.service.ts`'s `segment.metadata`), carried over so this
 * relation replaces that path without losing what it already did well.
 */
export function orderIntoActions(
  order: OrderIntoActions,
  existing: Record<string, unknown>,
): ActionItemProperties {
  const text = order.text ?? (existing.text as string | undefined) ?? (existing.content as string | undefined) ?? '';

  return ActionItemSchema.parse({
    ...existing,
    text,
    status: 'todo',
    priority: order.priority ?? null,
    deadline: order.deadline ?? null,
  });
}
