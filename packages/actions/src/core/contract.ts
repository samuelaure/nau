/**
 * What an actionable item is, independent of when it happens, who captured it,
 * and who shows it.
 *
 * The test every signature here must pass:
 *
 *   **Actions is what remains when nobody has decided when, who captures, nor
 *   who displays.**
 *
 * If a signature only makes sense for one time system, for one capture channel,
 * or for one screen, the core has stopped being a contract. Nothing in this
 * file names a calendar, a scale, a database, or a consuming module — and the
 * boundaries test fails the build if that ever changes.
 *
 * What lives here is the substance of an actionable item: what it is, how it
 * composes, and when it stops asking for attention. Everything about *when* it
 * happens belongs to the Time module; everything about how it got here belongs
 * to GTD.
 */

/**
 * The four shapes an item can take, derived from two orthogonal axes.
 *
 * |            | no recurrence | recurrence |
 * |------------|---------------|------------|
 * | no children| action        | habit      |
 * | children   | project       | routine    |
 *
 * Never stored. Adding recurrence turns an action into a habit and a project
 * into a routine; removing it turns them back — with no write, no migration,
 * and no second piece of state that can disagree with the first.
 *
 * This generalises what `isHabit = Boolean(recurrence)` already did as an
 * isolated case. Four explicit kinds would instead reintroduce the vocabulary
 * drift measured across production (`action` and `task` both live, with nothing
 * declaring which is canonical), and would force a write every time an item
 * crossed a cell.
 */
export type Shape = 'action' | 'habit' | 'project' | 'routine';

/**
 * How an item stopped asking for attention.
 *
 * Three outcomes, not two. All three stop the carry-over; they differ only in
 * what they leave on the record — which is exactly why they are distinct states
 * and not a boolean with a note beside it.
 *
 * `cancelled` exists because it is the alternative to deleting. Deleting
 * destroys the fact that something was ever planned; cancelling keeps it. A
 * history where discarded things simply vanish cannot tell "I never considered
 * it" from "I considered it and said no".
 */
export type Outcome = 'done' | 'cancelled';

/**
 * The state of an item, its own and never derived from its children.
 *
 * Both directions are real and were confirmed against practice: a project can
 * be closed without every sub-item being done, and every sub-item can be done
 * without the project being closed — which happens whenever not all the work
 * was written down in the first place.
 *
 * So the state cannot be computed from the children in either direction. It is
 * a field of its own.
 */
export type Status = 'todo' | Outcome;

/**
 * What the core needs to know about an item's placement in time.
 *
 * Deliberately minimal, and deliberately not Time's own vocabulary. The core
 * asks three yes/no questions and never learns what a month is, which system
 * resolved it, or how long anything lasts. A `Plan` carrying a scale id or a
 * recurrence string would leak a time system into a module that must survive
 * that system being switched off.
 */
export interface Plan {
  /** Whether this placement repeats. The axis that separates habit from action. */
  readonly recurs: boolean;
  /**
   * Whether the rule counts from the last completion rather than from a fixed
   * start.
   *
   * The core needs this for one reason only: such a rule has no next occurrence
   * until the current one is completed, which is what makes its carry-over
   * unbounded. See `attention.ts`.
   */
  readonly countsFromCompletion: boolean;
}

/**
 * An actionable item, as the core understands it.
 *
 * No id, no timestamps, no workspace: those are the substrate's business, and
 * an item that carried them could not be reasoned about without a database.
 * What the core sees is only what it needs to answer its own questions.
 */
export interface ActionItem {
  readonly status: Status;
  /**
   * Whether it has children. The composed axis, read from the tree rather than
   * stored — an item is composed because it has children, not because someone
   * declared it a container.
   */
  readonly hasChildren: boolean;
  /**
   * Its own placement in time, or none.
   *
   * Null is a meaningful state, not a defect: an item nobody has placed yet is
   * where a capture waits until someone decides when it happens. Capturing is
   * not planning.
   *
   * A child never inherits its parent's plan. It has its own or it has none —
   * see `governsChildren`.
   */
  readonly plan: Plan | null;
}
