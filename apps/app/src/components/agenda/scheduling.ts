/**
 * Turning what a person says about time into what the server stores: an
 * anchor, a scale, and optionally a rule.
 *
 * Deliberately small and free of components, so the vocabulary of "today, this
 * week, every three days" exists in one place and both the creator and the
 * editor speak it identically.
 *
 * What used to live here as `rangeOf`/`toInputDate` computed a period's range
 * on the client — the same class of drift the server-resolved-periods
 * migration removed everywhere else (nau#58, nau#93). The server resolves
 * where a week starts now; this file only names the scale a `WhenKind`
 * anchors to, via `scaleOf`.
 */

export type WhenKind = 'today' | 'week' | 'month' | 'date'

/** The scale a `WhenKind` anchors to. `date` is still a day-scale anchor. */
export function scaleOf(kind: WhenKind): 'day' | 'week' | 'month' {
  if (kind === 'week') return 'week'
  if (kind === 'month') return 'month'
  return 'day'
}

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
