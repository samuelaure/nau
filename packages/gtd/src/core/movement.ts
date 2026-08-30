import type { TrayMembership } from './tray';

/**
 * Capture, process and order, as one verb at three levels of specificity —
 * with the technical nuance each one keeps, per `tmp/gtd-blueprint.md` §2.2.
 *
 * |          | does                                          | effect                                                              |
 * |----------|-----------------------------------------------|----------------------------------------------------------------------|
 * | capture  | introduces the item to the system              | creates the membership in the general tray; no tray of origin        |
 * | process  | moves from one tray to a more specific one      | changes the membership; the item stays in pre-order state            |
 * | order    | takes the item out of its tray to its final home| ends the membership; the item becomes fully owned by its destination |
 *
 * Movements are recorded as events, not as an overwritten status. What tray
 * an item currently sits in — or whether it has been ordered at all — is
 * derived from the last event, never stored separately. Chosen over a flat
 * state field for two reasons: it gives real traceability of the flow (how
 * long something sits in a tray before being processed), and it matches the
 * pattern Actions already uses for its own transit events
 * (`block.rescheduled`).
 */
export type MovementKind = 'capture' | 'process' | 'order';

export interface Movement {
  readonly itemId: string;
  readonly kind: MovementKind;
  /** The tray of origin. Null for `capture` — there is no tray before it. */
  readonly from: string | null;
  /** The tray of destination. Null for `order` — the item leaves trays entirely. */
  readonly to: string | null;
  readonly at: string;
}

/**
 * The tray an item currently sits in, or null once it has been ordered.
 *
 * Derived from the last movement recorded for the item — never a field kept
 * in step by hand. Movements are assumed sorted oldest-first; the caller
 * owns fetching them in that order.
 */
export function currentTray(movements: readonly Movement[], itemId: string): string | null {
  const mine = movements.filter((m) => m.itemId === itemId);
  const last = mine[mine.length - 1];
  return last ? last.to : null;
}

/**
 * Whether an item has been ordered — left every tray for its final home.
 *
 * True exactly when the last movement recorded for it is an `order`. Not a
 * boolean anyone writes: the same discipline Actions applies to its own
 * derived `Shape` (`shapeOf`), applied here to whether an item is still in
 * transit.
 */
export function isOrdered(movements: readonly Movement[], itemId: string): boolean {
  const mine = movements.filter((m) => m.itemId === itemId);
  const last = mine[mine.length - 1];
  return last?.kind === 'order';
}

/**
 * Builds the membership implied by an item's current tray, or null once
 * ordered. A thin convenience over `currentTray` for callers that want the
 * `TrayMembership` shape rather than a bare tray id.
 */
export function membershipOf(
  movements: readonly Movement[],
  itemId: string,
): TrayMembership | null {
  const trayId = currentTray(movements, itemId);
  return trayId ? { trayId, itemId } : null;
}
