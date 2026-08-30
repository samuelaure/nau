import type { ActionItemProperties } from '../../schemas';

/**
 * `(GTD)·(Actions)` — the operation GTD invokes when a tray item is ordered
 * into Actions.
 *
 * **Confirms and corrects the draft published from `packages/gtd`**
 * (`packages/gtd/src/relations/actions/contract.ts`, per nau#114). Two
 * changes, both following the precedent `(GTD)·(Journal)` already set
 * (nau#115, `packages/journal/src/relations/gtd/contract.ts`) when it found
 * the same class of naming issue in its own first draft:
 *
 *   - **`blockId`, not `noteId`.** The field names the thing being ordered —
 *     a block whose `type` is about to mutate (nau#111). Calling it `noteId`
 *     bakes in an assumption about where every capture starts; `blockId` is
 *     the substrate-level name, and it is what `(GTD)·(Journal)` already
 *     settled on for the identical situation.
 *   - **No route bypasses the tray for Actions.** Journal has a genuine fast
 *     path (`(Journal)·(Zazŭ)`, `processJournalOnly` — someone picks
 *     "Journal" directly and never touches a tray) alongside its
 *     tray-mediated route (`(GTD)·(Journal)`, this same shape). Actions has
 *     no equivalent: `dispatchToActions` in `apps/zazu` still calls the old
 *     classifier triage (`journalOnly: false`) unconditionally — confirmed
 *     by reading the current code (2026-08-30), not assumed stale. Until
 *     that triage is replaced (nau#5, nau#109), everything reaching Actions
 *     from capture goes through a tray, so this file is the only contract
 *     `(Actions)·(GTD)` needs — there is no sibling `(Actions)·(Zazŭ)` to
 *     also define.
 *
 * Never builds a note or a block from scratch: per nau#111, every capture
 * already exists as `references.note` by the time `order` runs. This
 * relation only decides the properties the mutated block should carry once
 * its `type` becomes `actions.item` — the mutation itself is a
 * persistence-layer act (`api-actions`/`api-references` cooperating on the
 * same row), performed by the caller (GTD's own `(GTD)·(Actions)` relation,
 * or `apps/api` on its behalf), never by this pure package.
 */
export interface OrderIntoActions {
  /** The block already sitting in a tray, about to become an Actions item. */
  readonly blockId: string;
  /**
   * A correction to the item's text, if GTD's processing step changed it.
   * Falls back to the note's own text when absent.
   */
  readonly text?: string;
  readonly priority?: 'low' | 'medium' | 'high' | null;
  /** ISO instant. A soft deadline, distinct from `Planning` — see `order.ts`. */
  readonly deadline?: string | null;
}

/**
 * `itemId` is the same id as `OrderIntoActions.blockId` — ordering mutates
 * the block in place (nau#111), it does not create a new one. Kept as its
 * own field, same reasoning as `(GTD)·(Journal)`'s `OrderedIntoJournal`, so
 * a caller reading only the result doesn't have to know that fact to get the
 * id right.
 */
export interface OrderedIntoActions {
  readonly itemId: string;
}

/**
 * What ordering produces: the properties block, ready to be written once the
 * caller mutates `type` to `ACTIONS_ITEM_KIND`.
 *
 * A third export beyond the two interfaces above because, unlike
 * `(GTD)·(Journal)`'s `orderIntoJournal`, this relation's output must satisfy
 * `ActionItemSchema` — restated here so callers importing only the contract
 * (not `order.ts`) still see the real return shape.
 */
export type OrderedActionProperties = ActionItemProperties;
