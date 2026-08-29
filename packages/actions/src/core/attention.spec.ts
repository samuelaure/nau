import { claimsAttention, isResolved, type AttentionFacts } from './attention';
import type { ActionItem, Plan } from './contract';

const once: Plan = { recurs: false, countsFromCompletion: false };
const fixed: Plan = { recurs: true, countsFromCompletion: false };
const afterCompletion: Plan = { recurs: true, countsFromCompletion: true };

const pending = (plan: Plan | null): ActionItem => ({
  status: 'todo',
  hasChildren: false,
  plan,
});

const facts = (over: Partial<AttentionFacts> = {}): AttentionFacts => ({
  overdue: true,
  laterOccurrenceArrived: false,
  ...over,
});

describe('an item that is not overdue does not claim attention', () => {
  it('stays quiet while its period is still running', () => {
    expect(claimsAttention(pending(once), facts({ overdue: false }))).toBe(false);
  });

  // Rescheduling writes a plan whose period has not elapsed. The carry-over
  // does not stop by a special rule — it stops because the item is no longer
  // overdue, which is the same condition as any other.
  it('stops once rescheduled, because rescheduling makes it not overdue', () => {
    const item = pending(once);
    expect(claimsAttention(item, facts({ overdue: true }))).toBe(true);
    expect(claimsAttention(item, facts({ overdue: false }))).toBe(false);
  });
});

describe('an outcome stops the carry-over — both of them', () => {
  it('stops when done', () => {
    expect(claimsAttention({ ...pending(once), status: 'done' }, facts())).toBe(false);
  });

  // Cancelling settles the matter exactly as completing does. What differs is
  // what it leaves on the record, not whether it resolves.
  it('stops when cancelled', () => {
    expect(claimsAttention({ ...pending(once), status: 'cancelled' }, facts())).toBe(false);
  });
});

describe('the three behaviours fall out of one rule', () => {
  // Action / project: no recurrence, so no later occurrence can ever arrive.
  it('an overdue action carries indefinitely', () => {
    expect(claimsAttention(pending(once), facts())).toBe(true);
    expect(claimsAttention(pending(once), facts({ laterOccurrenceArrived: false }))).toBe(true);
  });

  // Habit counting from a fixed start: the next occurrence exists, is already
  // calculated, and replaces the carry-over when it arrives.
  it('a fixed-rule habit carries only until its next occurrence arrives', () => {
    expect(claimsAttention(pending(fixed), facts({ laterOccurrenceArrived: false }))).toBe(true);
    expect(claimsAttention(pending(fixed), facts({ laterOccurrenceArrived: true }))).toBe(false);
  });

  // The consistency check. A rule counting from completion has no next
  // occurrence until this one is completed, so a bounded carry-over would make
  // the item vanish for ever — its next occurrence depending on a completion
  // there would no longer be anywhere to record.
  it('a completion-anchored habit carries indefinitely', () => {
    expect(claimsAttention(pending(afterCompletion), facts())).toBe(true);
  });

  it('and stops only when it is completed or cancelled', () => {
    const item = pending(afterCompletion);
    expect(claimsAttention(item, facts())).toBe(true);
    expect(claimsAttention({ ...item, status: 'done' }, facts())).toBe(false);
    expect(claimsAttention({ ...item, status: 'cancelled' }, facts())).toBe(false);
  });
});

describe('the real cases behave as described', () => {
  // Three days between occurrences: overdue on days 1 and 2, replaced on day 3.
  it('a three-day habit carries for two days then is replaced', () => {
    const habit = pending(fixed);

    expect(claimsAttention(habit, facts({ laterOccurrenceArrived: false }))).toBe(true);
    expect(claimsAttention(habit, facts({ laterOccurrenceArrived: false }))).toBe(true);
    expect(claimsAttention(habit, facts({ laterOccurrenceArrived: true }))).toBe(false);
  });

  // Shaving, cutting nails, taking the bins out: more accurate anchored to the
  // last completion than to a fixed start.
  it('taking the bins out keeps asking until it is actually done', () => {
    const bins = pending(afterCompletion);

    expect(claimsAttention(bins, facts())).toBe(true);
    expect(claimsAttention({ ...bins, status: 'done' }, facts())).toBe(false);
  });
});

describe('isResolved', () => {
  it('is false while pending', () => {
    expect(isResolved({ status: 'todo' })).toBe(false);
  });

  it('is true for either outcome', () => {
    expect(isResolved({ status: 'done' })).toBe(true);
    expect(isResolved({ status: 'cancelled' })).toBe(true);
  });
});
