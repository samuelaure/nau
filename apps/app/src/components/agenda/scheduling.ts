/**
 * Turning what a person says about time into the two things the server stores:
 * a range, and optionally a rule.
 *
 * Deliberately small and free of components, so the vocabulary of "today, this
 * week, every three days" exists in one place and both the creator and the
 * editor speak it identically.
 */

export type WhenKind = 'today' | 'week' | 'month' | 'date'

export type FrequencyKind =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'everyNDays'
  | 'afterNDays'

export interface WhenValue {
  kind: WhenKind
  /** Only for `date`. A plain calendar day, YYYY-MM-DD. */
  date?: string
}

export interface FrequencyValue {
  kind: FrequencyKind
  /** Only for the two interval kinds. */
  n?: number
}

/** A calendar day as the browser's own clock reads it, not as UTC would. */
export function toInputDate(date: Date): string {
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The range a `WhenValue` names, in local time.
 *
 * A range and not a point, because that is the whole of deferring: "this week"
 * is Monday to Sunday and can be done at any moment inside it. A single day is
 * the degenerate case where both ends are the same day.
 */
export function rangeOf(when: WhenValue, today = new Date()): { start: Date; end: Date } {
  const base =
    when.kind === 'date' && when.date ? new Date(`${when.date}T00:00:00`) : new Date(today)

  const startOfDay = (d: Date) => new Date(new Date(d).setHours(0, 0, 0, 0))
  const endOfDay = (d: Date) => new Date(new Date(d).setHours(23, 59, 59, 999))

  switch (when.kind) {
    case 'week': {
      // ISO weeks: Monday first. Sunday counts as the last day of the week that
      // is ending, not the first of the one beginning.
      const day = base.getDay()
      const monday = new Date(base)
      monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { start: startOfDay(monday), end: endOfDay(sunday) }
    }
    case 'month': {
      const first = new Date(base.getFullYear(), base.getMonth(), 1)
      const last = new Date(base.getFullYear(), base.getMonth() + 1, 0)
      return { start: startOfDay(first), end: endOfDay(last) }
    }
    case 'today':
    case 'date':
    default:
      return { start: startOfDay(base), end: endOfDay(base) }
  }
}

/**
 * The RFC 5545 rule a `FrequencyValue` names, or null for a one-off.
 *
 * `afterNDays` produces the same rule as `everyNDays`. What separates them is
 * not the rule but where it counts from, which the server holds in
 * `recurrenceMode` — the rule itself cannot express an anchor that moves.
 */
export function rruleOf(frequency: FrequencyValue): string | null {
  const n = Math.max(1, Math.round(frequency.n ?? 1))
  switch (frequency.kind) {
    case 'daily':
      return 'FREQ=DAILY'
    case 'weekdays':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    case 'weekly':
      return 'FREQ=WEEKLY'
    case 'monthly':
      return 'FREQ=MONTHLY'
    case 'everyNDays':
    case 'afterNDays':
      return `FREQ=DAILY;INTERVAL=${n}`
    case 'none':
    default:
      return null
  }
}

export function modeOf(frequency: FrequencyValue): 'FIXED' | 'AFTER_COMPLETION' {
  return frequency.kind === 'afterNDays' ? 'AFTER_COMPLETION' : 'FIXED'
}

/** Reads a stored rule back into the vocabulary, for editing. */
export function frequencyFromRule(
  rrule: string | null | undefined,
  mode: 'FIXED' | 'AFTER_COMPLETION' = 'FIXED',
): FrequencyValue {
  if (!rrule) return { kind: 'none' }
  const rule = rrule.replace(/^RRULE:/i, '').toUpperCase()

  const interval = /INTERVAL=(\d+)/.exec(rule)
  if (interval) {
    const n = Number(interval[1])
    return { kind: mode === 'AFTER_COMPLETION' ? 'afterNDays' : 'everyNDays', n }
  }
  if (rule.includes('BYDAY=MO,TU,WE,TH,FR')) return { kind: 'weekdays' }
  if (rule.includes('FREQ=WEEKLY')) return { kind: 'weekly' }
  if (rule.includes('FREQ=MONTHLY')) return { kind: 'monthly' }
  if (rule.includes('FREQ=DAILY')) return { kind: 'daily' }
  return { kind: 'none' }
}

export const FREQUENCY_LABELS: Record<FrequencyKind, string> = {
  none: 'Sin frecuencia',
  daily: 'Cada día',
  weekdays: 'De lunes a viernes',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
  everyNDays: 'Cada N días',
  afterNDays: 'N días después de hacerlo',
}

export const WHEN_LABELS: Record<WhenKind, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
  date: 'Un día concreto',
}
