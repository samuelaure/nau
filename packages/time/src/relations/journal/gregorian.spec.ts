import { periodAt } from '../../systems/gregorian';
import type { ResolveContext } from '../../core/contract';
import {
  DIRECT_READ_TOKEN_BUDGET,
  composesFrom,
  exceedsBudget,
  gregorianJournal,
} from './gregorian';

const at = (iso: string) => new Date(iso);
const ctx: ResolveContext = { timezone: 'UTC', config: {} };

const period = (scale: string) => periodAt(scale, at('2026-08-20T12:00:00Z'), ctx)!;

describe('gregorianJournal.preferredSources — the composition rule', () => {
  it('reads a day from the entries themselves', () => {
    const plans = gregorianJournal.preferredSources(period('day'), ctx);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.kind).toBe('entries');
    expect(plans[0]!.fromScale).toBeNull();
  });

  // A week reads the days themselves rather than the daily syntheses, which
  // keeps it close to what was actually written.
  it('reads a week from the entries, not from daily syntheses', () => {
    const plans = gregorianJournal.preferredSources(period('week'), ctx);
    expect(plans[0]!.kind).toBe('entries');
    expect(plans[0]!.fromScale).toBeNull();
  });

  it('reads a month from the daily syntheses', () => {
    const plans = gregorianJournal.preferredSources(period('month'), ctx);
    expect(plans[0]!.kind).toBe('syntheses');
    expect(plans[0]!.fromScale).toBe('day');
  });

  it('reads a quarter from the weekly syntheses', () => {
    const plans = gregorianJournal.preferredSources(period('quarter'), ctx);
    expect(plans[0]!.fromScale).toBe('week');
  });

  it('reads a year from the monthly syntheses', () => {
    const plans = gregorianJournal.preferredSources(period('year'), ctx);
    expect(plans[0]!.fromScale).toBe('month');
  });

  // One plan, never a menu. What a period is made of is a property of the
  // calendar; swapping sources by size would make one month's synthesis mean
  // something different from the next.
  it('offers exactly one plan for every scale', () => {
    for (const scale of ['day', 'week', 'month', 'quarter', 'year']) {
      expect(gregorianJournal.preferredSources(period(scale), ctx)).toHaveLength(1);
    }
  });

  it('scopes the plan to the period being synthesised', () => {
    const target = period('month');
    expect(gregorianJournal.preferredSources(target, ctx)[0]!.range).toEqual(target.interval);
  });

  it('never composes from a scale outside this system', () => {
    for (const scale of ['month', 'quarter', 'year']) {
      const from = gregorianJournal.preferredSources(period(scale), ctx)[0]!.fromScale;
      expect(['day', 'week', 'month', 'quarter', 'year']).toContain(from);
    }
  });
});

describe('composesFrom', () => {
  it('states the dependency chain the scheduler walks', () => {
    expect(composesFrom('day')).toBeNull();
    expect(composesFrom('week')).toBeNull();
    expect(composesFrom('month')).toBe('day');
    expect(composesFrom('quarter')).toBe('week');
    expect(composesFrom('year')).toBe('month');
  });

  it('answers null for a scale it does not know', () => {
    expect(composesFrom('lunation')).toBeNull();
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

describe('exceedsBudget — measured, never enforced', () => {
  // Reports rather than decides. The composition rule is fixed, so this exists
  // only to make real volume visible before any limit is set on a guess.
  it('stays quiet for a request within the budget', () => {
    expect(exceedsBudget({ count: 12, estimatedTokens: 5_000 })).toBe(false);
  });

  it('flags a request over the budget', () => {
    expect(exceedsBudget({ count: 800, estimatedTokens: DIRECT_READ_TOKEN_BUDGET + 1 })).toBe(
      true,
    );
  });

  it('does not flag exactly the budget', () => {
    expect(exceedsBudget({ count: 1, estimatedTokens: DIRECT_READ_TOKEN_BUDGET })).toBe(false);
  });
});
