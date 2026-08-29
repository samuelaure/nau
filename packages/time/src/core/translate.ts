import type { Interval, ScaleRef, SystemId } from './contract';
import type { SystemRegistry } from './registry';
import { SCALE_TOLERANCE, visibleIn } from './interval';

/**
 * Showing things planned in one system inside another system's view.
 *
 * A block is planned in exactly one system; every other system sees it
 * translated. The translation is pure interval overlap — the core never asks
 * one system to interpret another's divisions, because the moment Gregorian
 * tried to read a lunar interval as "roughly a month" the systems would stop
 * being independent.
 *
 * Every translated item keeps the system it was planned in, which is what lets
 * a view either merge them into one list or split them into per-system lanes.
 * That is a presentation decision; the data supports both without changing.
 */

/** The minimum a thing must expose to be placed on a timeline. */
export interface Placed {
  /** Where it sits. Derived from its own system's period, never measured. */
  readonly interval: Interval;
  /** The system it was planned in. Preserved through translation. */
  readonly system: SystemId;
}

export interface TranslateOptions {
  /** Slack allowed when matching sizes. Defaults to `SCALE_TOLERANCE`. */
  readonly tolerance?: number;
  /**
   * Systems whose items the viewer has hidden.
   *
   * Every system doubles as a view, and within a view the items planned in
   * other systems can be shown or hidden. This is that switch — a filter, not a
   * capability, so hiding a system never changes what it computes.
   */
  readonly hiddenSystems?: readonly SystemId[];
}

/**
 * The items that belong in a view of one scale over one stretch of time.
 *
 * The rule is two independent tests, each doing its own job:
 *
 * 1. Does it overlap the stretch being viewed? — a question about time.
 * 2. Is it about the size of this view's scale? — a question about where it was
 *    placed, answered by comparing the width of two periods.
 *
 * The second is what keeps a task spanning all of August out of each of
 * August's thirty-one day views, without needing to know that it is a task.
 */
export function itemsForView<T extends Placed>(
  items: readonly T[],
  view: { readonly range: Interval; readonly scale: ScaleRef },
  registry: SystemRegistry,
  options: TranslateOptions = {},
): readonly T[] {
  const scale = registry.scale(view.scale.system, view.scale.scale);
  if (!scale) {
    throw new Error(
      `Unknown scale "${view.scale.scale}" for time system "${view.scale.system}"`,
    );
  }

  const tolerance = options.tolerance ?? SCALE_TOLERANCE;
  const hidden = new Set(options.hiddenSystems ?? []);

  return items.filter(
    (item) =>
      !hidden.has(item.system) &&
      visibleIn(item.interval, view.range, scale.typicalMs, tolerance),
  );
}
