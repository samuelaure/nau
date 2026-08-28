import type {
  Capabilities,
  Instant,
  Interval,
  Occurrence,
  Period,
  RecurrenceRule,
  ResolveContext,
  ScaleId,
  TimeSystem,
} from './contract';
import { SystemRegistry } from './registry';
import { itemsForView } from './translate';
import { contains, overlaps } from './interval';

/**
 * Whether the core contract is genuinely agnostic.
 *
 * Four stand-in systems, each breaking a different assumption that a
 * Gregorian-shaped core would have baked in. They are deliberately crude — the
 * point is not that their arithmetic is right, it is that the contract lets
 * them exist at all. If any of them cannot be expressed without a special case
 * in `core/`, the core is not agnostic and the contract is wrong.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);
const span = (start: Instant, end: Instant | null): Interval => ({ start, end });

const ctx: ResolveContext = { timezone: 'UTC', config: {} };

/** A: scales that nest, cheap arithmetic, projects freely. The easy case. */
const gregorianish: TimeSystem = {
  id: 'gregorian',
  name: 'Gregorian',
  scales: [
    { id: 'day', name: 'Day', typicalMs: DAY_MS },
    { id: 'week', name: 'Week', typicalMs: 7 * DAY_MS },
    { id: 'month', name: 'Month', typicalMs: 30 * DAY_MS, parent: 'year' },
    { id: 'year', name: 'Year', typicalMs: 365 * DAY_MS },
  ],
  capabilities: { projects: true, cost: 'arithmetic', concurrent: false, openEnded: false },
  periodAt(scale, instant) {
    const startOfDay = Date.UTC(
      instant.getUTCFullYear(),
      instant.getUTCMonth(),
      instant.getUTCDate(),
    );
    return {
      ref: { system: 'gregorian', scale, anchor: instant },
      interval: span(new Date(startOfDay), new Date(startOfDay + DAY_MS)),
      name: new Date(startOfDay).toISOString().slice(0, 10),
    };
  },
  periodsIn(scale, range) {
    const out: Period[] = [];
    if (range.end === null) return out;
    for (let t = range.start.getTime(); t < range.end.getTime(); t += DAY_MS) {
      const period = this.periodAt(scale, new Date(t), ctx);
      if (period) out.push(period);
    }
    return out;
  },
  occurrences() {
    return [];
  },
};

/**
 * B: scales that do NOT tile.
 *
 * Days 1-9, 10-18 and 19-27 are naŭ; whatever remains of the month is "fin de
 * mes", a different scale entirely. Asking for the naŭ containing the 28th is
 * answered with null, and that is a real answer rather than a failure.
 */
const nauish: TimeSystem = {
  id: 'nau',
  name: 'naŭ',
  scales: [
    { id: 'nau', name: 'Naŭ', typicalMs: 9 * DAY_MS },
    { id: 'fin-de-mes', name: 'Fin de mes', typicalMs: 3 * DAY_MS },
  ],
  capabilities: { projects: true, cost: 'arithmetic', concurrent: false, openEnded: false },
  periodAt(scale, instant) {
    const dayOfMonth = instant.getUTCDate();
    const year = instant.getUTCFullYear();
    const month = instant.getUTCMonth();

    if (scale === 'nau') {
      if (dayOfMonth > 27) return null; // Belongs to no naŭ. The whole point.
      const index = Math.floor((dayOfMonth - 1) / 9);
      const first = index * 9 + 1;
      return {
        ref: { system: 'nau', scale, anchor: instant },
        interval: span(
          new Date(Date.UTC(year, month, first)),
          new Date(Date.UTC(year, month, first + 9)),
        ),
        name: `Naŭ ${index + 1}`,
      };
    }

    if (dayOfMonth <= 27) return null; // Not in the remainder.
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return {
      ref: { system: 'nau', scale, anchor: instant },
      interval: span(
        new Date(Date.UTC(year, month, 28)),
        new Date(Date.UTC(year, month, daysInMonth + 1)),
      ),
      name: 'Fin de mes',
    };
  },
  periodsIn(scale, range) {
    const out: Period[] = [];
    if (range.end === null) return out;
    for (let t = range.start.getTime(); t < range.end.getTime(); t += DAY_MS) {
      const period = this.periodAt(scale, new Date(t), ctx);
      if (period && !out.some((p) => p.name === period.name)) out.push(period);
    }
    return out;
  },
  occurrences() {
    return [];
  },
};

/**
 * C: exact but expensive, with irregular boundaries.
 *
 * Counts every resolution so the test can prove the core does not fan out
 * calculations it was told are costly.
 */
let ephemerisCalls = 0;
const ephemerisish: TimeSystem = {
  id: 'ephemeris',
  name: 'Ephemeris',
  scales: [{ id: 'lunation', name: 'Lunation', typicalMs: 29.53 * DAY_MS }],
  capabilities: { projects: true, cost: 'computed', concurrent: false, openEnded: false },
  periodAt(scale, instant) {
    ephemerisCalls += 1;
    // A boundary at an arbitrary instant, not aligned to any calendar day.
    const epoch = at('2026-01-11T03:14:00Z').getTime();
    const length = 29.53 * DAY_MS;
    const index = Math.floor((instant.getTime() - epoch) / length);
    const start = epoch + index * length;
    return {
      ref: { system: 'ephemeris', scale, anchor: instant },
      interval: span(new Date(start), new Date(start + length)),
      name: `Lunation ${index}`,
    };
  },
  periodsIn(scale, range) {
    const out: Period[] = [];
    if (range.end === null) return out;
    let cursor = this.periodAt(scale, range.start, ctx);
    while (cursor && cursor.interval.start.getTime() < range.end.getTime()) {
      out.push(cursor);
      const next = cursor.interval.end;
      if (!next) break;
      cursor = this.periodAt(scale, next, ctx);
    }
    return out;
  },
  occurrences() {
    return [];
  },
};

/**
 * D: cannot project at all.
 *
 * Periods are declared from outside, open-ended and concurrent. It knows what
 * is running now and what ran before, and nothing whatsoever about next month.
 */
class TriggerSystem implements TimeSystem {
  readonly id = 'triggers';
  readonly name = 'Triggers';
  readonly scales = [{ id: 'phase', name: 'Phase', typicalMs: 5 * DAY_MS }];
  readonly capabilities: Capabilities = {
    projects: false,
    cost: 'arithmetic',
    concurrent: true,
    openEnded: true,
  };

  private declared: { name: string; interval: Interval }[] = [];

  declare(name: string, start: Instant, end: Instant | null): void {
    this.declared.push({ name, interval: span(start, end) });
  }

  periodAt(scale: ScaleId, instant: Instant): Period | null {
    const found = this.declared.find((d) => contains(d.interval, instant));
    if (!found) return null;
    return {
      ref: { system: this.id, scale, anchor: instant },
      interval: found.interval,
      name: found.name,
    };
  }

  periodsIn(scale: ScaleId, range: Interval): readonly Period[] {
    // Only what has actually been declared. Never invents to fill the range.
    return this.declared
      .filter((d) => overlaps(d.interval, range))
      .map((d) => ({
        ref: { system: this.id, scale, anchor: d.interval.start },
        interval: d.interval,
        name: d.name,
      }));
  }

  occurrences(_rule: RecurrenceRule): readonly Occurrence[] {
    return [];
  }
}

describe('the core contract accommodates four unlike systems', () => {
  const triggers = new TriggerSystem();
  const registry = new SystemRegistry([gregorianish, nauish, ephemerisish, triggers]);

  it('registers every system without knowing what any of them is', () => {
    expect(registry.all().map((s) => s.id).sort()).toEqual([
      'ephemeris',
      'gregorian',
      'nau',
      'triggers',
    ]);
  });

  describe('naŭ: scales that do not tile', () => {
    it('places an ordinary day in a naŭ', () => {
      const period = nauish.periodAt('nau', at('2026-08-12T10:00:00Z'), ctx);
      expect(period?.name).toBe('Naŭ 2');
    });

    // The case a tiling assumption would break on. Day 28 is in no naŭ, and the
    // contract lets the system say so instead of inventing a short one.
    it('answers null for a day that belongs to no naŭ', () => {
      expect(nauish.periodAt('nau', at('2026-08-28T10:00:00Z'), ctx)).toBeNull();
    });

    it('places that same day in the scale that does own it', () => {
      const period = nauish.periodAt('fin-de-mes', at('2026-08-28T10:00:00Z'), ctx);
      expect(period?.name).toBe('Fin de mes');
    });

    it('declares no parent for a scale that nests in nothing', () => {
      expect(nauish.scales.find((s) => s.id === 'nau')?.parent).toBeUndefined();
    });
  });

  describe('Gregorian: a week has no parent either', () => {
    // Even the easy system proves `parent` must be optional: a week crosses
    // month boundaries, so it belongs to no larger scale.
    it('leaves week without a parent while month has one', () => {
      expect(gregorianish.scales.find((s) => s.id === 'week')?.parent).toBeUndefined();
      expect(gregorianish.scales.find((s) => s.id === 'month')?.parent).toBe('year');
    });
  });

  describe('ephemeris: expensive and irregular', () => {
    it('declares itself costly so callers can batch', () => {
      expect(ephemerisish.capabilities.cost).toBe('computed');
    });

    it('has boundaries that align to no calendar day', () => {
      const period = ephemerisish.periodAt('lunation', at('2026-02-01T00:00:00Z'), ctx);
      expect(period!.interval.start.getUTCHours()).not.toBe(0);
    });

    it('is never resolved by translation, which compares instants only', () => {
      ephemerisCalls = 0;
      const items = [
        { system: 'ephemeris', interval: span(at('2026-08-10T03:14:00Z'), at('2026-08-11T03:14:00Z')) },
      ];
      itemsForView(
        items,
        {
          range: span(at('2026-08-01T00:00:00Z'), at('2026-09-01T00:00:00Z')),
          scale: { system: 'gregorian', scale: 'month' },
        },
        registry,
      );
      expect(ephemerisCalls).toBe(0);
    });
  });

  describe('triggers: a system that cannot see the future', () => {
    beforeAll(() => {
      triggers.declare('menstruating', at('2026-08-05T00:00:00Z'), at('2026-08-10T00:00:00Z'));
      triggers.declare('trip prep', at('2026-08-08T00:00:00Z'), null);
    });

    it('declares that it does not project', () => {
      expect(triggers.capabilities.projects).toBe(false);
    });

    it('invents no period for a future range it was never told about', () => {
      // The open-ended 'trip prep' is genuinely still running in 2027 — nobody
      // closed it — so it is reported. What must never appear is a *predicted*
      // period: this system has no idea when the next phase begins, and the
      // contract lets it stay silent instead of guessing a date an interface
      // would then draw as a plan.
      const future = span(at('2027-01-01T00:00:00Z'), at('2027-02-01T00:00:00Z'));
      const found = triggers.periodsIn('phase', future);
      expect(found.map((p) => p.name)).toEqual(['trip prep']);
      expect(
        found.every((p) => p.interval.start.getTime() < at('2027-01-01T00:00:00Z').getTime()),
      ).toBe(true);
    });

    it('reports nothing at all for a future range once everything is closed', () => {
      const closed = new TriggerSystem();
      closed.declare('menstruating', at('2026-08-05T00:00:00Z'), at('2026-08-10T00:00:00Z'));
      const future = span(at('2027-01-01T00:00:00Z'), at('2027-02-01T00:00:00Z'));
      expect(closed.periodsIn('phase', future)).toHaveLength(0);
    });

    it('reports the concurrent periods actually running at an instant', () => {
      const running = triggers.periodsIn(
        'phase',
        span(at('2026-08-09T00:00:00Z'), at('2026-08-09T12:00:00Z')),
      );
      expect(running.map((p) => p.name).sort()).toEqual(['menstruating', 'trip prep']);
    });

    it('keeps an open-ended period running with no known end', () => {
      const period = triggers.periodAt('phase', at('2030-01-01T00:00:00Z'));
      expect(period?.name).toBe('trip prep');
      expect(period?.interval.end).toBeNull();
    });
  });

  describe('translation across all four', () => {
    // The heart of it: items planned in four unlike systems, shown in one
    // Gregorian view, with the core never interpreting anyone's divisions.
    const items = [
      { system: 'gregorian', interval: span(at('2026-08-12T00:00:00Z'), at('2026-08-13T00:00:00Z')) },
      { system: 'nau', interval: span(at('2026-08-10T00:00:00Z'), at('2026-08-19T00:00:00Z')) },
      { system: 'ephemeris', interval: span(at('2026-08-10T03:14:00Z'), at('2026-09-08T18:00:00Z')) },
      { system: 'triggers', interval: span(at('2026-08-08T00:00:00Z'), null) },
    ];

    it('shows day-sized and naŭ-sized items in a week view, and nothing larger', () => {
      const shown = itemsForView(
        items,
        {
          range: span(at('2026-08-10T00:00:00Z'), at('2026-08-17T00:00:00Z')),
          scale: { system: 'gregorian', scale: 'week' },
        },
        registry,
      );
      // The lunation is month-sized and the trigger period is open-ended;
      // neither belongs in a week view.
      expect(shown.map((i) => i.system).sort()).toEqual(['gregorian', 'nau']);
    });

    it('shows the lunation once the view is a month', () => {
      const shown = itemsForView(
        items,
        {
          range: span(at('2026-08-01T00:00:00Z'), at('2026-09-01T00:00:00Z')),
          scale: { system: 'gregorian', scale: 'month' },
        },
        registry,
      );
      expect(shown.map((i) => i.system)).toContain('ephemeris');
    });

    it('keeps each item labelled with the system it was planned in', () => {
      const shown = itemsForView(
        items,
        {
          range: span(at('2026-08-10T00:00:00Z'), at('2026-08-17T00:00:00Z')),
          scale: { system: 'gregorian', scale: 'week' },
        },
        registry,
      );
      // Preserved so a view can merge them into one list or split them into
      // per-system lanes. Presentation decides; the data supports both.
      expect(shown.every((i) => typeof i.system === 'string')).toBe(true);
    });

    it('hides a system the viewer switched off', () => {
      const shown = itemsForView(
        items,
        {
          range: span(at('2026-08-10T00:00:00Z'), at('2026-08-17T00:00:00Z')),
          scale: { system: 'gregorian', scale: 'week' },
        },
        registry,
        { hiddenSystems: ['nau'] },
      );
      expect(shown.map((i) => i.system)).toEqual(['gregorian']);
    });

    it('translates into a naŭ view using the naŭ scale, symmetrically', () => {
      const shown = itemsForView(
        items,
        {
          range: span(at('2026-08-10T00:00:00Z'), at('2026-08-19T00:00:00Z')),
          scale: { system: 'nau', scale: 'nau' },
        },
        registry,
      );
      expect(shown.map((i) => i.system).sort()).toEqual(['gregorian', 'nau']);
    });

    it('refuses a view whose scale does not exist in its system', () => {
      expect(() =>
        itemsForView(
          items,
          {
            range: span(at('2026-08-10T00:00:00Z'), at('2026-08-17T00:00:00Z')),
            scale: { system: 'gregorian', scale: 'lunation' },
          },
          registry,
        ),
      ).toThrow(/Unknown scale/);
    });
  });
});
