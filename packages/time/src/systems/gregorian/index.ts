import type { TimeSystem } from '../../core/contract';
import { scales } from './scales';
import { periodAt, periodsIn } from './periods';
import { occurrences, type GregorianOccurrenceContext } from './recurrence';
import { validateConfig } from './config';

export const GREGORIAN_SYSTEM_ID = 'gregorian';

/**
 * The Gregorian calendar, as one time system among several.
 *
 * The first implementation of the core contract, and its first real test. It is
 * deliberately not privileged: nothing in `core/` knows this file exists, and
 * the naŭ, ephemeris and trigger systems will register the same way.
 *
 * Its capabilities are the easy set — it projects freely, costs nothing to
 * compute, has one period per scale at a time and no open ends. Those four
 * flags exist precisely because the other systems answer them differently, and
 * a core shaped around this system alone would never have needed them.
 *
 * What this file does NOT contain is anything about Journal. Composing a
 * period's synthesis from smaller ones is a *relation*, and it lives in
 * `relations/journal/gregorian.ts`. The dependency runs one way: that module
 * imports this one, and removing Journal entirely would not touch a line here.
 */
export const gregorian: TimeSystem = {
  id: GREGORIAN_SYSTEM_ID,
  name: 'Gregoriano',
  scales,
  capabilities: {
    projects: true,
    cost: 'arithmetic',
    concurrent: false,
    openEnded: false,
  },
  periodAt,
  periodsIn,
  occurrences: (rule, range, ctx) =>
    occurrences(rule, range, ctx as GregorianOccurrenceContext),
  validateConfig,
};

export { scales, GREGORIAN_SCALES, type GregorianScaleId, isGregorianScale } from './scales';
export {
  periodAt,
  periodsIn,
  closedPeriodAt,
  dayIn,
  localNow,
  dayjs,
} from './periods';
export {
  occurrences,
  overdueRatio,
  overridesFrom,
  type RecurrenceMode,
  type GregorianOccurrenceContext,
} from './recurrence';
export {
  readConfig,
  validateConfig,
  DEFAULT_GREGORIAN_CONFIG,
  type GregorianConfig,
} from './config';
