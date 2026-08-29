import { RRule, rrulestr } from 'rrule';

import type {
  Instant,
  Interval,
  Occurrence,
  OccurrenceContext,
  OccurrenceOverride,
  RecurrenceRule,
} from '../../core/contract';

/**
 * When a Gregorian rule actually lands.
 *
 * Occurrences are computed, never stored. A daily habit is one row and a rule;
 * asking what it means this week is arithmetic, and materialising 365 rows a
 * year to avoid that arithmetic buys nothing while costing a table that can
 * drift from the rule that generated it.
 *
 * Recurrence follows RFC 5545 via `rrule` — the standard every calendar speaks,
 * which is also what makes import and export possible later. That choice was
 * checked rather than assumed (2026-08-22): `rrule` has not been published
 * since November 2023, against `rrule-temporal` which is current and adds RFC
 * 7529. It remains the right pick — RFC 5545 was frozen in 2009, so a stale
 * spec-implementer is a far smaller risk than a stale framework; `rrule`
 * carries ten times the downloads; and `rrule-temporal` needs a Temporal
 * polyfill that Node 22 does not ship. RFC 7529 would not have helped the naŭ
 * calendar either way, since RSCALE names calendars from CLDR and an invented
 * one is not in it.
 *
 * The RRULE string never leaves this file. `RecurrenceRule.expression` is
 * opaque to everything outside `systems/gregorian`, which is what lets other
 * systems express recurrences RFC 5545 cannot describe at all.
 */

/**
 * Where a recurrence counts from.
 *
 * RFC 5545 only describes `FIXED`: a rule is a pure function of its start,
 * which is what lets a calendar answer for 2030 without knowing what anyone
 * did. That is right for "write in the journal every day" — missing today does
 * not make tomorrow count double.
 *
 * It cannot describe the other kind at all. "Shave three days after the last
 * shave" depends on completion history: shaving a day late should push the next
 * one out, not leave it where the calendar originally said. Todoist draws the
 * same line between `every 3 days` and `every! 3 days`.
 */
export type RecurrenceMode = 'FIXED' | 'AFTER_COMPLETION';

export interface GregorianOccurrenceContext extends OccurrenceContext {
  readonly mode?: RecurrenceMode;
}

/** How many projected occurrences an anchored rule will guess at, at most. */
const MAX_PROJECTIONS = 64;

export function occurrences(
  rule: RecurrenceRule,
  range: Interval,
  ctx: GregorianOccurrenceContext,
): readonly Occurrence[] {
  if (range.end === null) return [];

  const skipped = new Set<number>();
  const movedTo = new Map<number, Instant>();
  for (const override of ctx.overrides) {
    const key = override.occurrenceAt.getTime();
    if (override.kind === 'SKIPPED') skipped.add(key);
    else if (override.movedTo) movedTo.set(key, override.movedTo);
  }

  const decorate = (at: Instant, projected: boolean): Occurrence => {
    const moved = movedTo.get(at.getTime());
    return { at, effectiveAt: moved ?? at, moved: Boolean(moved), projected };
  };

  if (ctx.mode === 'AFTER_COMPLETION') {
    return anchored(rule, range, ctx, decorate, skipped);
  }

  const parsed = parseRule(rule.expression, ctx.startAt);
  if (!parsed) return [];

  const endAt = ctx.endAt ?? null;
  const hardEnd = endAt && endAt < range.end ? endAt : range.end;

  return parsed
    .between(range.start, hardEnd, true)
    .filter((at) => !skipped.has(at.getTime()))
    .map((at) => decorate(at, false));
}

/**
 * A rule that counts from the last completion.
 *
 * There is only ever one real occurrence: the one due now. Everything after it
 * depends on when this one is actually done, so it is returned marked as
 * projected — useful to fill a week view, never to be mistaken for a plan.
 *
 * The pending occurrence is returned even when it falls before the window. An
 * overdue shave does not stop being due because the day it was due has passed,
 * and dropping it would hide exactly what the person needs to see.
 */
function anchored(
  rule: RecurrenceRule,
  range: Interval,
  ctx: GregorianOccurrenceContext,
  decorate: (at: Instant, projected: boolean) => Occurrence,
  skipped: Set<number>,
): readonly Occurrence[] {
  const anchor = ctx.lastCompletedAt ?? ctx.startAt;
  const parsed = parseRule(rule.expression, anchor);
  if (!parsed) return [];

  const endAt = ctx.endAt ?? null;
  if (endAt && anchor > endAt) return [];
  if (range.end === null) return [];

  const pending = parsed.after(anchor, false);
  if (!pending) return [];
  if (endAt && pending > endAt) return [];
  if (pending > range.end) return [];
  if (skipped.has(pending.getTime())) return [];

  const out: Occurrence[] = [decorate(pending, false)];

  // An overdue occurrence gets no projections. Every one would be premised on a
  // completion that has not happened, answering "when is the next shave,
  // assuming you shaved on the fourth of July" — a question nobody asked. One
  // honest row beats a filled-in week.
  if (pending < range.start) return out;

  let cursor = pending;
  for (let i = 0; i < MAX_PROJECTIONS; i += 1) {
    const next = parsed.after(cursor, false);
    if (!next || next > range.end) break;
    if (endAt && next > endAt) break;
    if (!skipped.has(next.getTime())) out.push(decorate(next, true));
    cursor = next;
  }

  return out;
}

/**
 * How late something is, measured against its own next turn.
 *
 * Two days late means something different for a daily habit than for a monthly
 * one, so lateness is expressed as a fraction of the gap to the following
 * occurrence: 0 is on time, 1 is a whole turn late. The interface maps that
 * onto colour, and keeping the arithmetic here makes the scale one decision in
 * one place rather than a magic number in a stylesheet.
 *
 * The gap is measured from the due occurrence to the one after it, rather than
 * from a duration read off the rule. `FREQ=MONTHLY` has no constant interval —
 * February and March differ by three days — so a single number taken once and
 * reused would be wrong for most of the year.
 */
export function overdueRatio(
  rule: RecurrenceRule,
  dueAt: Instant,
  now: Instant,
  startAt: Instant,
): number {
  const late = now.getTime() - dueAt.getTime();
  if (late <= 0) return 0;

  const parsed = parseRule(rule.expression, startAt);
  if (!parsed) return 0;

  const next = parsed.after(dueAt, false);
  if (!next) return 0;

  const turnMs = next.getTime() - dueAt.getTime();
  if (turnMs <= 0) return 0;

  return late / turnMs;
}

/** Builds the override list a caller passes in `OccurrenceContext`. */
export function overridesFrom(
  raw: readonly { occurrenceAt: Instant; kind: 'SKIPPED' | 'MOVED'; movedTo: Instant | null }[],
): readonly OccurrenceOverride[] {
  return raw.map((o) => ({ occurrenceAt: o.occurrenceAt, kind: o.kind, movedTo: o.movedTo }));
}

function parseRule(expression: string, dtstart: Instant): RRule | null {
  try {
    // A rule may arrive as a bare RRULE line or as a full RFC 5545 block.
    return rrulestr(
      expression.includes('DTSTART')
        ? expression
        : `DTSTART:${toICalUtc(dtstart)}\n${normalise(expression)}`,
    ) as RRule;
  } catch {
    // A malformed rule yields nothing rather than taking down the whole agenda
    // for every other item on the day.
    return null;
  }
}

function normalise(expression: string): string {
  const trimmed = expression.trim();
  return trimmed.toUpperCase().startsWith('RRULE:') ? trimmed : `RRULE:${trimmed}`;
}

function toICalUtc(date: Instant): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
