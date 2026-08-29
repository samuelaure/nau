import type { ActionItem, Plan, Shape } from './contract';

/**
 * The two axes, and what falls out of them.
 *
 * Both are read from data that already exists for another reason — the tree
 * says whether there are children, the plan says whether it repeats — so
 * neither axis is a field anyone has to keep in step with reality.
 */

/** Whether an item repeats. Null plan means it does not. */
export function recurs(plan: Plan | null): boolean {
  return plan !== null && plan.recurs;
}

/**
 * The cell an item falls into.
 *
 * Derived on every call rather than stored. That is the whole point: adding a
 * frequency to an action makes it a habit at the next read, and removing it
 * makes it an action again, with nothing written and nothing to migrate.
 */
export function shapeOf(item: Pick<ActionItem, 'hasChildren' | 'plan'>): Shape {
  const repeating = recurs(item.plan);

  if (item.hasChildren) return repeating ? 'routine' : 'project';
  return repeating ? 'habit' : 'action';
}

/** Whether a shape is one of the composed ones. */
export function isComposed(shape: Shape): boolean {
  return shape === 'project' || shape === 'routine';
}

/** Whether a shape is one of the repeating ones. */
export function isRecurring(shape: Shape): boolean {
  return shape === 'habit' || shape === 'routine';
}

/**
 * Whether a parent governs a given child's timing.
 *
 * The rule that resolves the whole composed case, and it is applied **per
 * child, not per parent**: a parent can govern one child while another child
 * governs itself. That is what makes a mixed project expressible — "call the
 * movers on Tuesday" has its own plan and appears in its own period, while
 * "pack the books" has none and is drawn inside the project.
 *
 * A parent whose children all plan themselves is not thereby demoted to a mere
 * grouping: "get a first sale" is an intention in its own right whose
 * sub-actions are spread across periods and whose sub-habits keep their own
 * frequency. It still has its own state and its own plan.
 *
 * There is no inheritance of occurrences. A child without a plan has no
 * occurrences of its own; it is drawn inside its parent's — which is a
 * *presentation* rule and therefore lives in the relation with Time, never
 * here.
 */
export function governsChildren(child: Pick<ActionItem, 'plan'>): boolean {
  return child.plan === null;
}
