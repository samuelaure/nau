/**
 * `@nau/time` — periods, scales and recurrence for the naŭ Platform.
 *
 * The module answers two questions and no others: which periods exist and what
 * stretch each occupies, and when does something planned actually occur. It
 * does not know what an action, a habit or a journal entry is, and nothing that
 * needs to know belongs here.
 *
 * One implementation, shared by the API and the frontends. Two of them existed
 * before — `apps/api/src/common/time.ts` and `apps/app/src/lib/periods.ts` —
 * kept in agreement by a comment saying they must agree, and they did not: a
 * workspace whose week began on Sunday created items in one range and saw them
 * in another.
 *
 * The layering, enforced by `boundaries.spec.ts`:
 *
 *     relations/  ──▶  systems/  ──▶  core/
 *
 * `core/` defines the contract and knows no concrete system. `systems/`
 * implement it and know nothing of who consumes them. `relations/` hold what is
 * true of one system's dealings with one other module — `(Time·Gregorian)·Journal`
 * is a relation, and it is separate both from Time and from Journal.
 */

// ── The contract ────────────────────────────────────────────────────────────
export * from './core/contract';
export * from './core/interval';
export * from './core/zone';
export * from './core/registry';
export * from './core/translate';
export * from './core/journal-relation';

// ── Systems ─────────────────────────────────────────────────────────────────
export { gregorian, GREGORIAN_SYSTEM_ID } from './systems/gregorian';
export {
  scales as gregorianScales,
  GREGORIAN_SCALES,
  isGregorianScale,
  type GregorianScaleId,
} from './systems/gregorian/scales';
export {
  periodAt as gregorianPeriodAt,
  periodsIn as gregorianPeriodsIn,
  closedPeriodAt as gregorianClosedPeriodAt,
  dayIn,
  localNow,
} from './systems/gregorian/periods';
export {
  overdueRatio as gregorianOverdueRatio,
  type RecurrenceMode,
  type GregorianOccurrenceContext,
} from './systems/gregorian/recurrence';
export {
  readConfig as readGregorianConfig,
  DEFAULT_GREGORIAN_CONFIG,
  type GregorianConfig,
} from './systems/gregorian/config';

// ── Relations ───────────────────────────────────────────────────────────────
//
// Exported separately from the systems they concern, so a consumer that has no
// interest in Journal never pulls this in.
export {
  gregorianJournal,
  fitsDirectRead,
  DIRECT_READ_TOKEN_BUDGET,
} from './relations/journal/gregorian';
