import { periodAt } from '../../systems/gregorian';
import type { ResolveContext } from '../../core/contract';
import { DIRECT_READ_TOKEN_BUDGET, fitsDirectRead, gregorianJournal } from './gregorian';

const at = (iso: string) => new Date(iso);
const ctx: ResolveContext = { timezone: 'UTC', config: {} };

const period = (scale: string) => periodAt(scale, at('2026-08-20T12:00:00Z'), ctx)!;

describe('gregorianJournal.preferredSources', () => {
  it('offers only entries for a day: there is no smaller scale to compose from', () => {
    const plans = gregorianJournal.preferredSources(period('day'), ctx);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.kind).toBe('entries');
    expect(plans[0]!.fromScale).toBeNull();
  });

  it('offers entries first, then the scale below, for larger periods', () => {
    const plans = gregorianJournal.preferredSources(period('month'), ctx);
    expect(plans.map((p) => [p.kind, p.fromScale])).toEqual([
      ['entries', null],
      ['syntheses', 'day'],
    ]);
  });

  // A week straddles month boundaries, so a month reading weeks would import
  // days belonging to the neighbouring month. Days nest exactly.
  it('composes a month from days rather than weeks', () => {
    const plans = gregorianJournal.preferredSources(period('month'), ctx);
    expect(plans.find((p) => p.kind === 'syntheses')!.fromScale).toBe('day');
  });

  it('composes a quarter from months and a year from quarters', () => {
    expect(
      gregorianJournal.preferredSources(period('quarter'), ctx).find((p) => p.kind === 'syntheses')!
        .fromScale,
    ).toBe('month');
    expect(
      gregorianJournal.preferredSources(period('year'), ctx).find((p) => p.kind === 'syntheses')!
        .fromScale,
    ).toBe('quarter');
  });

  it('scopes every plan to the period being synthesised', () => {
    const target = period('month');
    for (const plan of gregorianJournal.preferredSources(target, ctx)) {
      expect(plan.range).toEqual(target.interval);
    }
  });

  // Composing across systems would be one system interpreting another's
  // divisions, which is the one thing translation must never do.
  it('never composes from a scale outside this system', () => {
    for (const scale of ['week', 'month', 'quarter', 'year']) {
      const plans = gregorianJournal.preferredSources(period(scale), ctx);
      for (const plan of plans) {
        if (plan.fromScale === null) continue;
        expect(['day', 'week', 'month', 'quarter', 'year']).toContain(plan.fromScale);
      }
    }
  });
});

describe('gregorianJournal.shouldSynthesise', () => {
  // Narrating a period nobody recorded is how summaries of empty months
  // describing events that never happened got written once before.
  it('declines a period with nothing in it', () => {
    expect(
      gregorianJournal.shouldSynthesise!(period('month'), { count: 0, estimatedTokens: 0 }),
    ).toBe(false);
  });

  it('accepts a period that holds anything at all', () => {
    expect(
      gregorianJournal.shouldSynthesise!(period('month'), { count: 1, estimatedTokens: 120 }),
    ).toBe(true);
  });
});

describe('fitsDirectRead', () => {
  // The point of deciding on density rather than duration: a quiet month can
  // hold less than a busy week, and should be read straight from the entries.
  it('accepts a quiet period within the budget', () => {
    expect(fitsDirectRead({ count: 12, estimatedTokens: 5_000 })).toBe(true);
  });

  it('rejects a dense period over the budget', () => {
    expect(fitsDirectRead({ count: 800, estimatedTokens: DIRECT_READ_TOKEN_BUDGET + 1 })).toBe(
      false,
    );
  });

  it('accepts exactly the budget', () => {
    expect(fitsDirectRead({ count: 1, estimatedTokens: DIRECT_READ_TOKEN_BUDGET })).toBe(true);
  });
});
