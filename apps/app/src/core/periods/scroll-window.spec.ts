import { stepDate, anchorRun, childScale, isToday } from './scroll-window'
import type { Scale } from '@nau/time'

describe('stepDate', () => {
  it('steps a day forward and back', () => {
    const d = new Date('2026-08-15T12:00:00')
    expect(stepDate(d, 'day', 1).getDate()).toBe(16)
    expect(stepDate(d, 'day', -1).getDate()).toBe(14)
  })

  it('steps a week by seven days', () => {
    const d = new Date('2026-08-15T12:00:00')
    expect(stepDate(d, 'week', 1).getDate()).toBe(22)
  })

  it('steps a month, crossing a year boundary', () => {
    const d = new Date('2026-12-15T12:00:00')
    const next = stepDate(d, 'month', 1)
    expect(next.getFullYear()).toBe(2027)
    expect(next.getMonth()).toBe(0)
  })

  it('steps a quarter by three months', () => {
    const d = new Date('2026-01-15T12:00:00')
    expect(stepDate(d, 'quarter', 1).getMonth()).toBe(3)
  })

  it('steps a year', () => {
    const d = new Date('2026-08-15T12:00:00')
    expect(stepDate(d, 'year', 2).getFullYear()).toBe(2028)
  })

  it('does not mutate the input date', () => {
    const d = new Date('2026-08-15T12:00:00')
    const before = d.getTime()
    stepDate(d, 'month', 1)
    expect(d.getTime()).toBe(before)
  })
})

describe('anchorRun', () => {
  const today = new Date('2026-08-15T12:00:00')

  it('returns past and future counts, future first, newest-to-oldest', () => {
    const run = anchorRun('day', 2, 1, today)
    expect(run).toHaveLength(3)
    // future(1), then past(0), past(1)
    expect(run[0].getDate()).toBe(16)
    expect(run[1].getDate()).toBe(15)
    expect(run[2].getDate()).toBe(14)
  })

  it('returns only today when past=1 and future=0', () => {
    const run = anchorRun('day', 1, 0, today)
    expect(run).toHaveLength(1)
    expect(run[0].getDate()).toBe(15)
  })

  it('returns nothing when both are zero', () => {
    expect(anchorRun('day', 0, 0, today)).toEqual([])
  })
})

describe('childScale', () => {
  const scales: readonly Scale[] = [
    { id: 'day', name: 'Día', typicalMs: 86400000 },
    { id: 'week', name: 'Semana', typicalMs: 604800000 },
    { id: 'month', name: 'Mes', typicalMs: 2592000000, parent: 'quarter' },
    { id: 'quarter', name: 'Trimestre', typicalMs: 7862400000, parent: 'year' },
    { id: 'year', name: 'Año', typicalMs: 31536000000 },
  ]

  it('finds the declared child of a scale', () => {
    expect(childScale(scales, 'quarter')).toBe('month')
    expect(childScale(scales, 'year')).toBe('quarter')
  })

  it('returns null for a scale with no declared child', () => {
    // Week has no parent declared for it by any scale — the Gregorian case
    // this exists to prove: a week crosses months and nests in nothing.
    expect(childScale(scales, 'week')).toBeNull()
    expect(childScale(scales, 'day')).toBeNull()
  })

  it('returns null for an unknown scale rather than throwing', () => {
    expect(childScale(scales, 'fortnight')).toBeNull()
  })

  it('picks the finest child when more than one scale declares the same parent', () => {
    const withTwoChildren: readonly Scale[] = [
      ...scales,
      { id: 'sprint', name: 'Sprint', typicalMs: 1209600000, parent: 'quarter' },
    ]
    // month (2,592,000,000ms) is finer than sprint (1,209,600,000ms)... wait,
    // sprint is actually finer here — this asserts whichever truly has the
    // smaller typicalMs wins, not an assumption about which one that is.
    expect(childScale(withTwoChildren, 'quarter')).toBe('sprint')
  })
})

describe('isToday', () => {
  it('is true for the same calendar day', () => {
    const now = new Date('2026-08-15T08:00:00')
    expect(isToday(new Date('2026-08-15T23:00:00'), now)).toBe(true)
  })

  it('is false for a different day, even by one millisecond across midnight', () => {
    const now = new Date('2026-08-15T00:00:00')
    expect(isToday(new Date('2026-08-14T23:59:59'), now)).toBe(false)
  })
})
