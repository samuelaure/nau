import type { ResolveContext, TimeSystem } from './contract';
import { SystemRegistry } from './registry';
import { periodsBetween } from './periods-between';
import { gregorian } from '../systems/gregorian';

const at = (iso: string) => new Date(iso);
const ctx: ResolveContext = { timezone: 'UTC', config: { firstDayOfWeek: 1 } };

describe('periodsBetween', () => {
  const registry = new SystemRegistry([gregorian]);

  it('counts whole days between two instants', () => {
    const n = periodsBetween(
      registry,
      'gregorian',
      'day',
      at('2026-08-10T00:00:00Z'),
      at('2026-08-15T00:00:00Z'),
      ctx,
    );
    expect(n).toBe(5);
  });

  it('counts whole months, correct across differing lengths', () => {
    // Jan (31) + Feb (28, 2026 not a leap year) + Mar (31) elapsed by 1 Apr.
    const n = periodsBetween(
      registry,
      'gregorian',
      'month',
      at('2026-01-01T00:00:00Z'),
      at('2026-04-01T00:00:00Z'),
      ctx,
    );
    expect(n).toBe(3);
  });

  it('stays correct across a DST transition, unlike a nominal-length divide', () => {
    // 25-31 Oct 2026 spans the Spain clock change; a naive 24h-day divide would
    // misreport the elapsed day count here.
    const n = periodsBetween(
      registry,
      'gregorian',
      'day',
      at('2026-10-24T00:00:00Z'),
      at('2026-10-31T00:00:00Z'),
      { timezone: 'Europe/Madrid', config: {} },
    );
    expect(n).toBe(7);
  });

  it('returns 0 for a range that has not elapsed a single period', () => {
    const n = periodsBetween(
      registry,
      'gregorian',
      'day',
      at('2026-08-10T00:00:00Z'),
      at('2026-08-10T12:00:00Z'),
      ctx,
    );
    expect(n).toBe(0);
  });

  it('returns 0 when `to` is at or before `from`', () => {
    expect(
      periodsBetween(registry, 'gregorian', 'day', at('2026-08-10T00:00:00Z'), at('2026-08-10T00:00:00Z'), ctx),
    ).toBe(0);
    expect(
      periodsBetween(registry, 'gregorian', 'day', at('2026-08-10T00:00:00Z'), at('2026-08-05T00:00:00Z'), ctx),
    ).toBe(0);
  });

  it('returns null for an unregistered system, never throws', () => {
    expect(periodsBetween(registry, 'nau', 'naŭ', at('2026-08-01T00:00:00Z'), at('2026-08-10T00:00:00Z'), ctx))
      .toBeNull();
  });

  // The case #104 was written for: a system where "periods elapsed" has no
  // answer must say so, not force the caller to special-case it.
  it('returns null for a system that cannot answer the question, never a caller-side special case', () => {
    const noAnswer: TimeSystem = {
      id: 'someday',
      name: 'Some Day / May Be',
      scales: [{ id: 'someday', name: 'Some Day', typicalMs: Infinity }],
      capabilities: { projects: false, cost: 'arithmetic', concurrent: true, openEnded: true },
      periodAt: () => null,
      periodsIn: () => [],
      occurrences: () => [],
    };
    const registryWithSomeday = new SystemRegistry([noAnswer]);

    expect(
      periodsBetween(
        registryWithSomeday,
        'someday',
        'someday',
        at('2026-08-01T00:00:00Z'),
        at('2026-08-10T00:00:00Z'),
        ctx,
      ),
    ).toBeNull();
  });

  it('does not spin forever on a misbehaving system, and reports null instead', () => {
    let calls = 0;
    const cycling: TimeSystem = {
      id: 'cycling',
      name: 'Cycling',
      scales: [{ id: 'x', name: 'X', typicalMs: 1000 }],
      capabilities: { projects: true, cost: 'arithmetic', concurrent: false, openEnded: false },
      periodAt: (_scale, instant) => {
        calls += 1;
        // Always reports a period ending a millisecond after it starts, well
        // inside the range — a pathological system that never advances enough
        // to exit the loop on its own.
        return {
          ref: { system: 'cycling', scale: 'x', anchor: instant },
          interval: { start: instant, end: new Date(instant.getTime() + 1) },
          name: 'x',
        };
      },
      periodsIn: () => [],
      occurrences: () => [],
    };
    const registryWithCycling = new SystemRegistry([cycling]);

    const n = periodsBetween(
      registryWithCycling,
      'cycling',
      'x',
      at('2026-08-01T00:00:00Z'),
      at('2026-08-02T00:00:00Z'),
      ctx,
    );

    expect(n).toBeNull();
    expect(calls).toBeLessThan(1000);
  });
});
