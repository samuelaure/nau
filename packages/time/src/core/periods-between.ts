import type { Instant, ResolveContext, ScaleId, SystemId } from './contract';
import type { SystemRegistry } from './registry';

/**
 * How many whole periods of a scale separate two instants.
 *
 * Asked for by `nau#104`: `agenda.service.ts` used to answer this by importing
 * `gregorianPeriodAt` directly and walking it in a loop — Actions knowing that
 * Gregorian exists, which `nau#57` forbids. The walk itself was already
 * correct (confirmed in `nau#60`, replacing an older version that divided by a
 * nominal unit length and mishandled quarters); what was missing was moving it
 * to the place that knows what a period is.
 *
 * `null`, not a thrown error, for a system where the question has no answer —
 * `someday` (`nau#98`) has no "periods elapsed", and a trigger-driven system's
 * periods are not counted the same way either. The caller never special-cases
 * this: it is exactly the failure mode `AGENDA_TYPES` taught this platform to
 * avoid, restated here as the reason `null` is a real answer rather than a
 * caller-side branch.
 *
 * Bounded so a malformed range or a misbehaving system cannot spin forever —
 * the same guard the code being replaced already had.
 */
export function periodsBetween(
  registry: SystemRegistry,
  system: SystemId,
  scale: ScaleId,
  from: Instant,
  to: Instant,
  ctx: ResolveContext,
): number | null {
  const timeSystem = registry.find(system);
  if (!timeSystem) return null;

  // The right test is the declared capability, not `periodAt` returning null
  // at the start: a system that DOES project can still answer null for one
  // instant — naŭ's "fin de mes" is null and naŭ still projects fine. What
  // makes "how many periods elapsed" meaningless is a system that cannot
  // enumerate periods forward at all, which is exactly what `projects` says.
  if (!timeSystem.capabilities.projects) return null;

  if (to.getTime() <= from.getTime()) return 0;

  let count = 0;
  let cursor = timeSystem.periodAt(scale, from, ctx);

  while (cursor && cursor.interval.end && cursor.interval.end.getTime() <= to.getTime()) {
    count += 1;
    if (count > 512) return null; // A cycling or misbehaving system, not a real count.
    cursor = timeSystem.periodAt(scale, cursor.interval.end, ctx);
  }

  return count;
}
