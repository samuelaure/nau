import type { Scale, ScaleId, SystemId } from '@nau/time'

/**
 * Which periods are on screen while scrolling — pure client-side windowing.
 *
 * `@nau/time` resolves what a period *is*; nothing in it knows about an
 * infinite-scroll list of them, because that is a presentation concern of
 * whichever module renders one. This file is that concern, factored out to
 * `core/` rather than left inside `time/`: it takes only
 * `@nau/time`'s types as parameters, has no opinion on what a period being
 * empty or full *means* — that's `(Time)·Actions` or `(Time)·Journal`
 * territory — and more than one relation needs exactly this windowing
 * (Actions does, Journal will). A relation genuinely specific to Time
 * (`use-time-systems.ts`, `use-periods.ts` — the actual `/time/*` HTTP calls)
 * stays in `time/`; this doesn't call the network at all,
 * which is the test for whether something belongs in `core/`.
 */

export interface ScaleRef {
  system: SystemId
  scale: ScaleId
}

/**
 * One step of `scale`, forward or back, from a given date.
 *
 * Gregorian-shaped stepping (whole weeks/months/quarters/years) because the
 * only system wired up today is Gregorian. A system whose scales do not
 * step this way — naŭ's non-tiling months, an ephemeris system — needs its
 * own stepping rule; nothing here assumes every system fits this shape, it
 * only implements Gregorian's.
 */
export function stepDate(date: Date, scale: ScaleId, steps: number): Date {
  const d = new Date(date)
  switch (scale) {
    case 'week':
      d.setDate(d.getDate() + 7 * steps)
      return d
    case 'month':
      d.setMonth(d.getMonth() + steps)
      return d
    case 'quarter':
      d.setMonth(d.getMonth() + 3 * steps)
      return d
    case 'year':
      d.setFullYear(d.getFullYear() + steps)
      return d
    case 'day':
    default:
      d.setDate(d.getDate() + steps)
      return d
  }
}

/**
 * A run of anchor dates, newest first, centred on today.
 *
 * `future` steps ahead and `past` steps behind — what an infinite scroll in
 * both directions asks for: reaching either end simply widens the count.
 * These are anchors to resolve, not periods; resolving them is
 * `usePeriodAt`'s job, against the server.
 */
export function anchorRun(scale: ScaleId, past: number, future: number, today = new Date()): Date[] {
  const out: Date[] = []
  for (let i = future; i > 0; i -= 1) out.push(stepDate(today, scale, i))
  for (let i = 0; i < past; i += 1) out.push(stepDate(today, scale, -i))
  return out
}

/**
 * The scale one level down from this one, for expanding a period in place.
 *
 * Reads `Scale.parent` from the system's own declared scales rather than a
 * hardcoded hierarchy — `SUB_GRANULARITY` in the deleted `lib/periods.ts`
 * assumed a total order (year → quarter → month → day) that is Gregorian's
 * own shape, not every system's. A scale with no declared child (a week,
 * which crosses month boundaries and nests in nothing) correctly returns
 * null rather than the caller having to know that specially.
 */
export function childScale(scales: readonly Scale[], scale: ScaleId): ScaleId | null {
  const children = scales.filter((s) => s.parent === scale)
  if (children.length === 0) return null
  // Smallest typical duration: a quarter's declared child could in principle
  // be month or (if ever added) some other sub-division; take the finest.
  return children.reduce((a, b) => (a.typicalMs < b.typicalMs ? a : b)).id
}

export function isToday(date: Date, now = new Date()): boolean {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}
