/**
 * `@nau/actions` — actionable items for the naŭ Platform.
 *
 * The module answers what an actionable item *is*: how it composes, what state
 * it holds, and when it stops asking for attention. It does not know when
 * anything happens, who captured it, or who displays it.
 *
 *   **Actions is what remains when nobody has decided when, who captures, nor
 *   who displays.**
 *
 * Four shapes — action, habit, project, routine — are not four types. They are
 * the cells of two orthogonal axes, both derived from data that already exists:
 * whether an item has children, and whether its plan repeats. Nothing about the
 * cell is stored, so adding a frequency turns an action into a habit with no
 * write and no migration.
 *
 * The layering, enforced by `boundaries.spec.ts`:
 *
 *     relations/  ──▶  core/
 *
 * `core/` is the contract and knows no time system, no database, and no
 * consuming module. `relations/` hold what is true of Actions' dealings with
 * one other module — the agenda is `(Time)·(Actions)` and belongs to neither.
 *
 * The rule that makes the module genuinely extractable: **`core/` does not
 * import `@nau/time`.** If the core compiles and passes its tests with Time
 * switched off, the module can be forked out of the platform and still work.
 */

export * from './core/contract';
export * from './core/shape';
export * from './core/attention';
export * from './core/completion';
