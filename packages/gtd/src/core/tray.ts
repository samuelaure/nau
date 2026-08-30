/**
 * A tray, and what it means for an item to sit inside one.
 *
 * Per `tmp/gtd-blueprint.md` §2.1: a tray is not a fixed list of three or
 * four destinations. It is any container in a pre-order state — a place
 * where something waits for intentional placement without affecting
 * anything else in the system in the meantime. The general inbox and a
 * specific project's own tray ("Mudanza") are trays of the exact same kind;
 * only their specificity differs.
 *
 * Recursive and arbitrary on purpose. A fixed hierarchy of phases would have
 * been the same mistake `AGENDA_TYPES` was for Actions — a hardcoded
 * enumeration where the contract should declare the shape, not the cases.
 * The list of trays that exist is data, owned by whichever module's
 * relation created it; this file never names one.
 */

/**
 * Any container in pre-order state. Nesting is what lets a secondary tray
 * sit close to its eventual destination without the item being fully
 * ordered yet — the whole reason secondary trays exist at all.
 */
export interface Tray {
  readonly id: string;
  /** The tray that contains this one, if this is a secondary tray. */
  readonly parentTrayId: string | null;
}

/**
 * That an item sits in a tray right now. Being a member of a tray is the
 * property that separates "captured, in stand-by" from "ordered" — not an
 * extra status field alongside it.
 */
export interface TrayMembership {
  readonly trayId: string;
  readonly itemId: string;
}

/** Whether one tray is nested, directly or transitively, under another. */
export function isDescendantOf(
  trays: readonly Tray[],
  trayId: string,
  ancestorId: string,
): boolean {
  let current = trays.find((t) => t.id === trayId);
  const seen = new Set<string>();

  while (current?.parentTrayId) {
    if (current.parentTrayId === ancestorId) return true;
    // Guards a malformed cycle from looping forever — trays are meant to
    // form a tree, and a cycle is a data error, not a case to model.
    if (seen.has(current.id)) return false;
    seen.add(current.id);
    current = trays.find((t) => t.id === current!.parentTrayId);
  }

  return false;
}
