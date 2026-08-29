import { gregorian, type ScaleId } from '@nau/time'
import type { ResolvedPeriod } from '@/relations/app-time/use-periods'
import { anchorRun, childScale, stepDate } from '@/relations/app-time/scroll-window'

/**
 * Actions' own vocabulary for "what size are the periods in this list".
 *
 * Not a new type — an alias. `@nau/time`'s `Scale`/`ScaleId` is the source of
 * truth (nau#93); this exists only so Actions' own code can say `Granularity`
 * without spelling out `ScaleId` everywhere, and so this file is the one place
 * that would need to change if Actions ever needed a name spanning more than
 * one time system's scales. Today it does not: Gregorian's ids already are
 * `day | week | month | quarter | year`.
 */
export type Granularity = ScaleId

/**
 * A period, in the shape Actions' components read.
 *
 * Everything here is the server's answer (`ResolvedPeriod`, from
 * `relations/app-time/use-periods.ts`) reshaped into what the deleted
 * `lib/periods.ts` used to hand-compute. The computation is gone; the shape
 * survives because the components built against it. `start`/`end` are `Date`
 * instead of the wire's ISO strings because callers already do `Date` math on
 * them — HierarchicalSection, ItemComposer, the scroll window.
 */
export interface PeriodSlot {
  /** Stable identity, and the anchor to hand back to the server. */
  key: string
  start: Date
  end: Date
  label: string
  granularity: Granularity
}

/** What Time's period-resolution endpoints call the same thing. */
export const API_SCALE: Record<Granularity, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  quarter: 'quarter',
  year: 'year',
}

export const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
]

const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The scale one level down, for expanding a period in place.
 *
 * Delegates to `childScale`, which reads a scale's declared `parent` from
 * `@nau/time` rather than assuming Gregorian's total order. A week correctly
 * has no child — it crosses month boundaries and nests in nothing — and this
 * is where that already-correct answer reaches Actions' components, rather
 * than Actions keeping its own copy of `SUB_GRANULARITY`.
 */
export function subGranularity(granularity: Granularity): Granularity | null {
  return childScale(gregorian.scales, granularity)
}

/**
 * A server-resolved period, reshaped into a `PeriodSlot`.
 *
 * The server is the source of truth for where a period starts and ends — see
 * `usePeriodsIn`/`usePeriodAt`. This function does no calendar arithmetic of
 * its own; it only relabels fields, which is the entire point of the
 * migration off `lib/periods.ts`'s client-side `periodOf`.
 */
export function toSlot(period: ResolvedPeriod): PeriodSlot {
  return {
    key: toKey(new Date(period.anchor)),
    start: new Date(period.from),
    // A period with no known end (Time's `openEnded` systems, e.g. `someday`)
    // has no `to`. Falling back to `from` keeps `end` a `Date` rather than
    // pushing null-handling onto every caller — none of Actions' current
    // views render an open-ended period, so this is a safe placeholder rather
    // than a claim about when it ends.
    end: period.to ? new Date(period.to) : new Date(period.from),
    label: period.title ?? period.name,
    granularity: period.scale,
  }
}

/** Whether a slot's range contains the given instant. */
export function isCurrent(slot: PeriodSlot, now = new Date()): boolean {
  return now >= slot.start && now <= slot.end
}

/**
 * The anchors for a run of periods, newest first, centred on today — for the
 * infinite scroll to resolve against the server.
 *
 * A thin re-export of `scroll-window`'s `anchorRun`/`stepDate`, kept in this
 * file so Actions' components import one module for "everything about the
 * periods on screen" rather than reaching into `app-time` directly for half of
 * it. `app-time` itself does no resolving — see the note on `anchorRun`: these
 * are anchors, not periods, and `usePeriodsIn` is what turns them into slots.
 */
export function periodAnchors(
  granularity: Granularity,
  past: number,
  future: number,
  today = new Date(),
): Date[] {
  return anchorRun(granularity, past, future, today)
}

/** The anchor one step away from a given one, forward or back. */
export function stepAnchor(anchor: Date, granularity: Granularity, steps: number): Date {
  return stepDate(anchor, granularity, steps)
}
