/**
 * The vocabulary of periods a view can be scrolled through.
 *
 * The Gregorian calendar is one way of dividing time and this module speaks only
 * that one. The naŭ calendar (nine-day weeks, twenty-seven-day months),
 * astrological transits and personal epochs are other ways, and each will name
 * and bound its divisions differently. What they will share is the shape of the
 * answer below — a key, a range and a label — so adding one is a new set of
 * functions rather than a change to everything that renders a period.
 */

export type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'year'

/**
 * Settings that belong to the calendar rather than to the person reading it.
 *
 * A week only exists inside Gregorian, so which day opens one is a property of
 * that calendar. The naŭ calendar will answer entirely different questions.
 */
export interface CalendarConfig {
  /** 0 = Sunday, 1 = Monday. ISO says Monday; plenty of the world says Sunday. */
  firstDayOfWeek?: number
}

export interface PeriodSlot {
  /** Stable identity, and what the API is asked about. `YYYY-MM-DD` of its start. */
  key: string
  start: Date
  end: Date
  label: string
  granularity: Granularity
}

export const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
]

/** What the server calls the same thing. */
export const API_PERIOD: Record<Granularity, string> = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  quarter: 'trimester',
  year: 'yearly',
}

/** The granularity one level down, for expanding a period in place. */
export const SUB_GRANULARITY: Record<Granularity, Granularity | null> = {
  day: null,
  week: 'day',
  month: 'day',
  quarter: 'month',
  year: 'month',
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function endOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(23, 59, 59, 999)
  return out
}

/**
 * The period of a given granularity that contains a date.
 *
 * Weeks run Monday to Sunday. Sunday is the last day of the week that is ending,
 * not the first of the one beginning — the same convention the server uses, and
 * getting it wrong by a day is what made every weekly summary cover an empty
 * future week for months.
 */
export function periodOf(
  date: Date,
  granularity: Granularity,
  config?: CalendarConfig,
): PeriodSlot {
  const d = new Date(date)

  switch (granularity) {
    case 'week': {
      // Must match the server exactly. If the two disagree about where a week
      // starts, the list draws one week while the summaries describe another and
      // nothing says so.
      const firstDay = config?.firstDayOfWeek ?? 1
      const offset = (d.getDay() - firstDay + 7) % 7
      const first = new Date(d)
      first.setDate(d.getDate() - offset)
      const last = new Date(first)
      last.setDate(first.getDate() + 6)
      return {
        key: toKey(startOfDay(first)),
        start: startOfDay(first),
        end: endOfDay(last),
        label: `${first.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${last.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        granularity,
      }
    }
    case 'month': {
      const first = new Date(d.getFullYear(), d.getMonth(), 1)
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return {
        key: toKey(first),
        start: startOfDay(first),
        end: endOfDay(last),
        label: first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
        granularity,
      }
    }
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3)
      const first = new Date(d.getFullYear(), q * 3, 1)
      const last = new Date(d.getFullYear(), q * 3 + 3, 0)
      return {
        key: toKey(first),
        start: startOfDay(first),
        end: endOfDay(last),
        label: `${q + 1}º trimestre de ${first.getFullYear()}`,
        granularity,
      }
    }
    case 'year': {
      const first = new Date(d.getFullYear(), 0, 1)
      const last = new Date(d.getFullYear(), 11, 31)
      return {
        key: toKey(first),
        start: startOfDay(first),
        end: endOfDay(last),
        label: String(first.getFullYear()),
        granularity,
      }
    }
    case 'day':
    default:
      return {
        key: toKey(d),
        start: startOfDay(d),
        end: endOfDay(d),
        label: d.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        granularity: 'day',
      }
  }
}

/** The period `offset` steps away from this one. Negative goes back. */
export function shiftPeriod(
  slot: PeriodSlot,
  offset: number,
  config?: CalendarConfig,
): PeriodSlot {
  const d = new Date(slot.start)
  switch (slot.granularity) {
    case 'week':
      d.setDate(d.getDate() + 7 * offset)
      break
    case 'month':
      d.setMonth(d.getMonth() + offset)
      break
    case 'quarter':
      d.setMonth(d.getMonth() + 3 * offset)
      break
    case 'year':
      d.setFullYear(d.getFullYear() + offset)
      break
    default:
      d.setDate(d.getDate() + offset)
  }
  return periodOf(d, slot.granularity, config)
}

/**
 * A run of periods, newest first, centred on today.
 *
 * `future` periods ahead and `past` behind, which is what an infinite scroll in
 * both directions asks for: reaching either end simply widens the count.
 */
export function periodRun(
  granularity: Granularity,
  past: number,
  future: number,
  today = new Date(),
  config?: CalendarConfig,
): PeriodSlot[] {
  const current = periodOf(today, granularity, config)
  const out: PeriodSlot[] = []
  for (let i = future; i > 0; i -= 1) out.push(shiftPeriod(current, i, config))
  for (let i = 0; i < past; i += 1) out.push(shiftPeriod(current, -i, config))
  return out
}

/** The sub-periods a period contains, for expanding it one level in place. */
export function subPeriods(slot: PeriodSlot, config?: CalendarConfig): PeriodSlot[] {
  const sub = SUB_GRANULARITY[slot.granularity]
  if (!sub) return []

  const out: PeriodSlot[] = []
  let cursor = periodOf(slot.start, sub, config)
  // Bounded so a malformed range can never spin: a year holds twelve months and
  // a month at most thirty-one days.
  for (let guard = 0; guard < 400 && cursor.start <= slot.end; guard += 1) {
    out.push(cursor)
    cursor = shiftPeriod(cursor, 1, config)
  }
  return out
}

export function isCurrent(slot: PeriodSlot, now = new Date()): boolean {
  return now >= slot.start && now <= slot.end
}
