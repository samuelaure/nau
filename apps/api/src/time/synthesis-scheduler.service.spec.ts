import { Test, TestingModule } from '@nestjs/testing';
import { gregorianPeriodAt } from '@nau/time';
import { SynthesisSchedulerService } from './synthesis-scheduler.service';
import { WorkspaceTimeService } from './workspace-time.service';
import { JournalService } from '../relations/journal/journal.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  Prisma: {},
}));

/**
 * The scheduler decides *when* a period closed and *what* it is made of.
 *
 * The composition rule for Gregorian: a day and a week read entries; a month
 * reads daily syntheses, a quarter weekly ones, a year monthly ones. Asking for
 * a year can therefore require most of a calendar to be built from nothing, and
 * that descent is what these tests are mostly about.
 */

const ctx = { timezone: 'UTC', config: { firstDayOfWeek: 0 } };

describe('SynthesisSchedulerService', () => {
  let service: SynthesisSchedulerService;
  let generateSynthesis: jest.Mock;
  let entriesIn: jest.Mock;
  let synthesesStartingIn: jest.Mock;
  let workspaceFindMany: jest.Mock;

  /** Entry ids present per day, and synthesis starts already generated. */
  let entriesByDay: Map<string, string[]>;
  let existingSyntheses: Set<string>;

  beforeEach(async () => {
    generateSynthesis = jest.fn().mockResolvedValue({ success: true });
    workspaceFindMany = jest.fn().mockResolvedValue([{ id: 'ws-1' }]);
    entriesByDay = new Map();
    existingSyntheses = new Set();

    // Stands in for JournalService's typed contract — the seam nau#63 asked
    // for, replacing a mocked `$queryRaw` that let the raw-SQL coupling hide
    // behind a passing test.
    entriesIn = jest.fn().mockImplementation((_ws: string, range: { start: Date; end: Date }) => {
      const out: { id: string; at: Date; textLength: number }[] = [];
      for (const [day, ids] of entriesByDay) {
        const at = new Date(`${day}T12:00:00Z`);
        if (at >= range.start && at < range.end) {
          out.push(...ids.map((id) => ({ id, at, textLength: 400 })));
        }
      }
      return Promise.resolve(out.sort((a, b) => a.at.getTime() - b.at.getTime()));
    });

    synthesesStartingIn = jest
      .fn()
      .mockImplementation((_ws: string, range: { start: Date; end: Date }) =>
        Promise.resolve(
          [...existingSyntheses]
            .map((iso) => new Date(iso))
            .filter((d) => d >= range.start && d < range.end)
            .map((d) => ({ id: `syn-${d.toISOString()}`, at: d, textLength: 400 })),
        ),
      );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SynthesisSchedulerService,
        { provide: PrismaService, useValue: { workspace: { findMany: workspaceFindMany } } },
        {
          provide: WorkspaceTimeService,
          useValue: { resolveContext: jest.fn().mockResolvedValue(ctx) },
        },
        { provide: JournalService, useValue: { generateSynthesis, entriesIn, synthesesStartingIn } },
      ],
    }).compile();

    service = module.get(SynthesisSchedulerService);

    // Every generated synthesis becomes visible to later lookups, which is what
    // lets the recursion build upward.
    generateSynthesis.mockImplementation((dto: { from: string }) => {
      existingSyntheses.add(new Date(dto.from).toISOString());
      return Promise.resolve({ success: true });
    });
  });

  const period = (scale: string, at: string) => gregorianPeriodAt(scale, new Date(at), ctx)!;

  const scalesGenerated = () =>
    generateSynthesis.mock.calls.map((c) => {
      const { from, to } = c[0];
      const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
      if (days <= 1) return 'day';
      if (days <= 7) return 'week';
      if (days <= 31) return 'month';
      if (days <= 92) return 'quarter';
      return 'year';
    });

  describe('the composition rule', () => {
    it('builds a day straight from its entries', async () => {
      entriesByDay.set('2026-08-17', ['e1', 'e2']);

      const result = await service.synthesise('ws-1', period('day', '2026-08-17T12:00:00Z'), ctx);

      expect(result.generated).toBe(true);
      expect(generateSynthesis).toHaveBeenCalledWith(
        expect.objectContaining({ sourceKind: 'entries', sourceIds: ['e1', 'e2'] }),
      );
    });

    it('builds a week from its entries, not from daily syntheses', async () => {
      entriesByDay.set('2026-08-17', ['e1']);
      entriesByDay.set('2026-08-19', ['e2']);

      await service.synthesise('ws-1', period('week', '2026-08-19T12:00:00Z'), ctx);

      expect(generateSynthesis).toHaveBeenCalledTimes(1);
      expect(generateSynthesis).toHaveBeenCalledWith(
        expect.objectContaining({ sourceKind: 'entries' }),
      );
    });

    it('builds a month from daily syntheses', async () => {
      entriesByDay.set('2026-08-03', ['e1']);
      entriesByDay.set('2026-08-04', ['e2']);

      await service.synthesise('ws-1', period('month', '2026-08-15T12:00:00Z'), ctx);

      // Two days generated first, then the month that reads them.
      expect(scalesGenerated()).toEqual(['day', 'day', 'month']);
      const monthCall = generateSynthesis.mock.calls[generateSynthesis.mock.calls.length - 1]![0];
      expect(monthCall.sourceKind).toBe('syntheses');
      expect(monthCall.sourceIds).toHaveLength(2);
    });
  });

  describe('generating what is missing, from the bottom up', () => {
    it('generates the missing days before the month that needs them', async () => {
      entriesByDay.set('2026-08-10', ['e1']);
      existingSyntheses.add(new Date('2026-08-10T00:00:00Z').toISOString());
      entriesByDay.set('2026-08-11', ['e2']);

      await service.synthesise('ws-1', period('month', '2026-08-15T12:00:00Z'), ctx);

      // The 10th already had one, so only the 11th is generated below the month.
      expect(scalesGenerated()).toEqual(['day', 'month']);
    });

    it('descends two levels: a year builds months, which build days', async () => {
      entriesByDay.set('2026-03-05', ['e1']);
      entriesByDay.set('2026-07-20', ['e2']);

      await service.synthesise('ws-1', period('year', '2026-06-15T12:00:00Z'), ctx);

      // Each month with material builds its day first, then itself, then the
      // year reads the months.
      expect(scalesGenerated()).toEqual(['day', 'month', 'day', 'month', 'year']);
    });

    it('skips a sub-period with nothing in it rather than generating it empty', async () => {
      entriesByDay.set('2026-08-03', ['e1']);
      // Every other day of August is silent.

      await service.synthesise('ws-1', period('month', '2026-08-15T12:00:00Z'), ctx);

      // Absence of material stops the descent; absence of a synthesis does not.
      expect(scalesGenerated()).toEqual(['day', 'month']);
    });

    it('generates nothing at all for a period nobody wrote in', async () => {
      const result = await service.synthesise(
        'ws-1',
        period('month', '2026-08-15T12:00:00Z'),
        ctx,
      );

      expect(generateSynthesis).not.toHaveBeenCalled();
      expect(result.generated).toBe(false);
      expect(result.reason).toBe('no sources');
    });

    it('stops rather than recursing forever if a rule ever cycles', async () => {
      entriesByDay.set('2026-08-03', ['e1']);

      const result = await service.synthesise(
        'ws-1',
        period('year', '2026-08-15T12:00:00Z'),
        ctx,
        9,
      );

      expect(result.reason).toBe('depth');
    });
  });

  describe('the hourly tick', () => {
    const tickAt = (iso: string) => service.tick(new Date(iso));

    it('synthesises the day that just closed, at local midnight', async () => {
      entriesByDay.set('2026-08-17', ['e1']);

      await tickAt('2026-08-18T00:30:00Z');

      expect(scalesGenerated()).toEqual(['day']);
    });

    it('does nothing at an hour no scale is scheduled for', async () => {
      entriesByDay.set('2026-08-17', ['e1']);

      await tickAt('2026-08-18T09:30:00Z');

      expect(generateSynthesis).not.toHaveBeenCalled();
    });

    it('generates a month once, on the tick after it closed', async () => {
      entriesByDay.set('2026-08-03', ['e1']);

      // 02:00 on 1 September is the month run; August is the closed month.
      await tickAt('2026-09-01T02:30:00Z');
      const first = generateSynthesis.mock.calls.length;

      // The same hour a day later must not regenerate it: August stays the
      // "closed month" until October, which is the trap this guards against.
      generateSynthesis.mockClear();
      await tickAt('2026-09-02T02:30:00Z');

      expect(first).toBeGreaterThan(0);
      expect(generateSynthesis).not.toHaveBeenCalled();
    });

    it('keeps one workspace’s failure from stopping the rest', async () => {
      workspaceFindMany.mockResolvedValue([{ id: 'ws-broken' }, { id: 'ws-ok' }]);
      entriesByDay.set('2026-08-17', ['e1']);

      const resolveContext = service['time'].resolveContext as jest.Mock;
      resolveContext.mockImplementationOnce(() => Promise.reject(new Error('boom')));

      await expect(tickAt('2026-08-18T00:30:00Z')).resolves.toBeUndefined();
      expect(generateSynthesis).toHaveBeenCalled();
    });
  });
});
