import { Test, TestingModule } from '@nestjs/testing';
import { AgendaService } from './agenda.service';
import { BlocksService } from '../blocks/blocks.service';
import { BlockEventsService } from '../blocks/block-events.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  Prisma: {},
}));

const MONDAY = '2026-08-17';

const scheduledBlock = (over: {
  id: string;
  type?: string;
  title?: string;
  rrule?: string | null;
  startDate?: string;
  endDate?: string | null;
  sortOrder?: number;
  estimateMinutes?: number;
  recurrenceMode?: 'FIXED' | 'AFTER_COMPLETION';
  exceptions?: unknown[];
}) => ({
  id: over.id,
  type: over.type ?? 'action',
  properties: {
    text: over.title ?? over.id,
    sortOrder: over.sortOrder ?? 0,
    ...(over.estimateMinutes ? { estimateMinutes: over.estimateMinutes } : {}),
  },
  schedule: {
    id: `sch-${over.id}`,
    blockId: over.id,
    startDate: new Date(over.startDate ?? '2026-08-17T08:00:00.000Z'),
    endDate: over.endDate ? new Date(over.endDate) : null,
    rrule: over.rrule ?? null,
    timezone: null,
    recurrenceMode: over.recurrenceMode ?? 'FIXED',
    exceptions: over.exceptions ?? [],
  },
});

describe('AgendaService — one list for actions and habits', () => {
  let service: AgendaService;
  let blockFindMany: jest.Mock;
  let eventFindMany: jest.Mock;
  let blocks: jest.Mocked<BlocksService>;
  let events: jest.Mocked<BlockEventsService>;
  let prismaWorkspace: { findUnique: jest.Mock };

  beforeEach(async () => {
    blockFindMany = jest.fn().mockResolvedValue([]);
    eventFindMany = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgendaService,
        {
          provide: PrismaService,
          useValue: {
            block: { findMany: blockFindMany, update: jest.fn() },
            event: { findMany: eventFindMany },
            schedule: { findUnique: jest.fn().mockResolvedValue({ rrule: null }) },
            workspace: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
            $transaction: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: BlocksService,
          useValue: {
            assertWorkspaceMembership: jest.fn(),
            assertBlockAccess: jest.fn().mockResolvedValue({ id: 'b1', workspaceId: 'ws-1' }),
            update: jest.fn(),
          },
        },
        { provide: BlockEventsService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(AgendaService);
    blocks = module.get(BlocksService);
    events = module.get(BlockEventsService);
    prismaWorkspace = module.get(PrismaService).workspace as unknown as {
      findUnique: jest.Mock;
    };
  });

  afterEach(() => jest.clearAllMocks());

  const agenda = (period: any = 'daily', date = MONDAY, now = new Date('2026-08-17T12:00:00.000Z')) =>
    service.forPeriod({ userId: 'u1', workspaceId: 'ws-1', period, date, now });

  it('puts a habit and an action in the same list, ordered together', async () => {
    blockFindMany.mockResolvedValue([
      scheduledBlock({ id: 'task', type: 'action', title: 'Enviar el informe', sortOrder: 1 }),
      scheduledBlock({
        id: 'habit',
        type: 'habit',
        title: 'Meditar',
        rrule: 'FREQ=DAILY',
        sortOrder: 0,
      }),
    ]);

    const result = await agenda();

    // The habit sorts first because its sortOrder says so, not because it is a
    // habit. Every tool that separates the two forces the person to merge them
    // mentally.
    expect(result.items.map((i) => i.title)).toEqual(['Meditar', 'Enviar el informe']);
    expect(result.items.map((i) => i.type)).toEqual(['habit', 'action']);
  });

  it('expands a recurring habit across a week without storing occurrences', async () => {
    blockFindMany.mockResolvedValue([
      scheduledBlock({ id: 'habit', type: 'habit', rrule: 'FREQ=DAILY' }),
    ]);

    const result = await agenda('weekly');

    expect(result.items).toHaveLength(7);
    expect(result.items.every((i) => i.recurring)).toBe(true);
  });

  it('marks an action deferred to a period as spanning it', async () => {
    blockFindMany.mockResolvedValue([
      scheduledBlock({
        id: 'deferred',
        startDate: '2026-08-17T00:00:00.000Z',
        endDate: '2026-08-23T23:59:59.999Z',
      }),
    ]);

    const result = await agenda('weekly');

    // Due at some point inside the week rather than at a moment in it.
    expect(result.items[0]!.spansPeriod).toBe(true);
  });

  it('reads completion from the event log, per occurrence', async () => {
    blockFindMany.mockResolvedValue([
      scheduledBlock({ id: 'habit', type: 'habit', rrule: 'FREQ=DAILY' }),
    ]);
    eventFindMany.mockResolvedValue([
      {
        type: 'occurrence.completed',
        blockId: 'habit',
        metadata: { occurrenceAt: '2026-08-18T08:00:00.000Z' },
      },
    ]);

    const result = await agenda('weekly');
    const done = result.items.filter((i) => i.done);

    // One day of the week, not the whole habit: a habit is never simply "done".
    expect(done).toHaveLength(1);
    expect(done[0]!.occurrenceAt).toBe('2026-08-18T08:00:00.000Z');
  });

  it('lets a later reopening undo an earlier completion', async () => {
    blockFindMany.mockResolvedValue([
      scheduledBlock({ id: 'habit', type: 'habit', rrule: 'FREQ=DAILY' }),
    ]);
    eventFindMany.mockResolvedValue([
      {
        type: 'occurrence.completed',
        blockId: 'habit',
        metadata: { occurrenceAt: '2026-08-18T08:00:00.000Z' },
      },
      {
        type: 'occurrence.reopened',
        blockId: 'habit',
        metadata: { occurrenceAt: '2026-08-18T08:00:00.000Z' },
      },
    ]);

    const result = await agenda('weekly');

    expect(result.items.filter((i) => i.done)).toHaveLength(0);
  });

  it('drops a skipped occurrence from the agenda entirely', async () => {
    blockFindMany.mockResolvedValue([
      scheduledBlock({
        id: 'habit',
        type: 'habit',
        rrule: 'FREQ=DAILY',
        exceptions: [
          { occurrenceAt: new Date('2026-08-19T08:00:00.000Z'), kind: 'SKIPPED', movedTo: null },
        ],
      }),
    ]);

    const result = await agenda('weekly');

    expect(result.items).toHaveLength(6);
  });

  it('totals only what is still pending, and counts what has no estimate', async () => {
    blockFindMany.mockResolvedValue([
      scheduledBlock({ id: 'a', estimateMinutes: 90 }),
      scheduledBlock({ id: 'b', estimateMinutes: 30, startDate: '2026-08-17T10:00:00.000Z' }),
      scheduledBlock({ id: 'c', startDate: '2026-08-17T12:00:00.000Z' }),
    ]);
    eventFindMany.mockResolvedValue([
      {
        type: 'occurrence.completed',
        blockId: 'b',
        metadata: { occurrenceAt: '2026-08-17T10:00:00.000Z' },
      },
    ]);

    const result = await agenda();

    // Finished work does not make a day look busier than it is.
    expect(result.plannedMinutes).toBe(90);
    expect(result.unestimatedCount).toBe(1);
  });

  describe('setCompletion', () => {
    it('records against the predicted instant, not the moment of ticking', async () => {
      // Catching up on yesterday's habit must not mark it done today, or the
      // streak describes the wrong days.
      const occurrenceAt = '2026-08-16T08:00:00.000Z';

      await service.setCompletion({
        userId: 'u1',
        blockId: 'habit',
        occurrenceAt,
        done: true,
      });

      expect(events.record).toHaveBeenCalledWith(
        'occurrence.completed',
        expect.anything(),
        { occurrenceAt },
        'u1',
      );
    });

    it('mirrors state onto the block for a one-off, so the rest of the app sees it', async () => {
      await service.setCompletion({
        userId: 'u1',
        blockId: 'task',
        occurrenceAt: '2026-08-17T08:00:00.000Z',
        done: true,
      });

      expect(blocks.update).toHaveBeenCalledWith('u1', 'task', {
        properties: { status: 'done' },
      });
    });

    it('leaves a recurring block alone, because a habit is never done', async () => {
      const prisma = (service as unknown as { prisma: { schedule: { findUnique: jest.Mock } } })
        .prisma;
      prisma.schedule.findUnique.mockResolvedValue({ rrule: 'FREQ=DAILY' });

      await service.setCompletion({
        userId: 'u1',
        blockId: 'habit',
        occurrenceAt: '2026-08-17T08:00:00.000Z',
        done: true,
      });

      expect(blocks.update).not.toHaveBeenCalled();
    });
  });

  describe('carry-over of what was not done', () => {
    const overdueTask = () =>
      blockFindMany.mockResolvedValue([
        scheduledBlock({
          id: 'olvidada',
          title: 'Enviar el informe',
          startDate: '2026-08-14T09:00:00.000Z',
          endDate: '2026-08-14T09:00:00.000Z',
        }),
      ]);

    it('shows an unfinished action in the period being lived now', async () => {
      overdueTask();

      const result = await agenda('daily', MONDAY);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.carriedFrom).toBe('2026-08-14T09:00:00.000Z');
    });

    it('counts the periods it has been carried, so it cannot be ignored forever', async () => {
      overdueTask();

      const result = await agenda('daily', MONDAY);

      // Friday to Monday.
      expect(result.items[0]!.carriedPeriods).toBe(3);
    });

    it('does not carry into a past period that is merely being looked at', async () => {
      // Looking back at last Tuesday should show last Tuesday, not last Tuesday
      // plus everything still open since.
      overdueTask();

      const result = await agenda('daily', '2026-08-16', new Date('2026-08-17T12:00:00.000Z'));

      expect(result.items).toHaveLength(0);
    });

    it('stops carrying once it is done', async () => {
      overdueTask();
      eventFindMany.mockResolvedValue([
        {
          type: 'occurrence.completed',
          blockId: 'olvidada',
          metadata: { occurrenceAt: '2026-08-14T09:00:00.000Z' },
        },
      ]);

      const result = await agenda('daily', MONDAY);

      expect(result.items).toHaveLength(0);
    });

    it('carries at the granularity it was planned at, not into today', async () => {
      // An action deferred to a month belongs in the month view. Dropping it
      // into today's list would defeat the point of having deferred it.
      blockFindMany.mockResolvedValue([
        scheduledBlock({
          id: 'mensual',
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-07-31T23:59:59.999Z',
        }),
      ]);

      const daily = await agenda('daily', MONDAY);
      const monthly = await agenda('monthly', MONDAY);

      expect(daily.items).toHaveLength(0);
      expect(monthly.items).toHaveLength(1);
      expect(monthly.items[0]!.carriedPeriods).toBe(1);
    });

    it('never carries a habit: a missed one does not accumulate', async () => {
      blockFindMany.mockResolvedValue([
        scheduledBlock({
          id: 'habit',
          type: 'habit',
          rrule: 'FREQ=DAILY',
          startDate: '2026-08-01T08:00:00.000Z',
        }),
      ]);

      const result = await agenda('daily', MONDAY);

      expect(result.items.every((i) => i.carriedFrom === null)).toBe(true);
    });

    it('counts manual deferrals separately from the automatic carry', async () => {
      // One is a decision, the other is time passing. Two counters, two signals.
      overdueTask();
      eventFindMany.mockResolvedValue([
        { type: 'block.rescheduled', blockId: 'olvidada', metadata: {} },
        { type: 'block.rescheduled', blockId: 'olvidada', metadata: {} },
      ]);

      const result = await agenda('daily', MONDAY);

      expect(result.items[0]!.rescheduledCount).toBe(2);
      expect(result.items[0]!.carriedPeriods).toBe(3);
    });
  });

  describe('habits derived and anchored', () => {
    it('calls anything with a recurrence a habit, without storing the type', async () => {
      blockFindMany.mockResolvedValue([
        scheduledBlock({ id: 'con-frecuencia', type: 'action', rrule: 'FREQ=DAILY' }),
        scheduledBlock({ id: 'sin-frecuencia', type: 'action' }),
      ]);

      const result = await agenda();

      expect(result.items.find((i) => i.blockId === 'con-frecuencia')!.isHabit).toBe(true);
      expect(result.items.find((i) => i.blockId === 'sin-frecuencia')!.isHabit).toBe(false);
    });

    it('reports how late an anchored habit is, relative to its own rhythm', async () => {
      blockFindMany.mockResolvedValue([
        scheduledBlock({
          id: 'afeitarme',
          type: 'habit',
          rrule: 'FREQ=DAILY;INTERVAL=3',
          recurrenceMode: 'AFTER_COMPLETION',
          startDate: '2026-08-01T08:00:00.000Z',
        }),
      ]);
      eventFindMany.mockResolvedValue([
        {
          type: 'occurrence.completed',
          blockId: 'afeitarme',
          metadata: { occurrenceAt: '2026-08-11T08:00:00.000Z' },
        },
      ]);

      // Due on the 14th, looked at on the 17th: one whole interval late.
      const result = await agenda('daily', MONDAY, new Date('2026-08-17T08:00:00.000Z'));

      expect(result.items[0]!.overdue).toBe(1);
    });

    it('leaves a fixed habit with no lateness, because it does not accumulate', async () => {
      blockFindMany.mockResolvedValue([
        scheduledBlock({ id: 'diario', type: 'habit', rrule: 'FREQ=DAILY' }),
      ]);

      const result = await agenda();

      expect(result.items.every((i) => i.overdue === 0)).toBe(true);
    });

    it('keeps projections out of the planned time', async () => {
      // Half of a projected week is a guess. Counting it as planned would make
      // the capacity warning fire on work that may never be scheduled.
      blockFindMany.mockResolvedValue([
        scheduledBlock({
          id: 'anclado',
          type: 'habit',
          rrule: 'FREQ=DAILY;INTERVAL=2',
          recurrenceMode: 'AFTER_COMPLETION',
          estimateMinutes: 30,
          startDate: '2026-08-17T08:00:00.000Z',
        }),
      ]);

      const result = await agenda('weekly', MONDAY, new Date('2026-08-17T07:00:00.000Z'));

      expect(result.items.filter((i) => i.projected).length).toBeGreaterThan(0);
      expect(result.plannedMinutes).toBe(30);
    });
  });

  describe('forRange — many periods at once', () => {
    const range = (from = '2026-08-17', to = '2026-08-23', now = new Date('2026-08-20T12:00:00.000Z')) =>
      service.forRange({ userId: 'u1', workspaceId: 'ws-1', from, to, period: 'daily', now });

    it('expands a daily habit across every day in the span', async () => {
      blockFindMany.mockResolvedValue([
        scheduledBlock({ id: 'habit', type: 'habit', rrule: 'FREQ=DAILY' }),
      ]);

      const result = await range();

      expect(result.items).toHaveLength(7);
    });

    it('tells each row which day to draw it under', async () => {
      blockFindMany.mockResolvedValue([
        scheduledBlock({ id: 'habit', type: 'habit', rrule: 'FREQ=DAILY' }),
      ]);

      const result = await range();

      // Grouping back into days is arithmetic on the client, so every row has to
      // say where it belongs without the client recomputing occurrences.
      expect(result.items.every((i) => i.shownAt === i.effectiveAt)).toBe(true);
    });

    it('carries an overdue task onto today, not onto every day in the span', async () => {
      blockFindMany.mockResolvedValue([
        scheduledBlock({
          id: 'olvidada',
          startDate: '2026-08-14T09:00:00.000Z',
          endDate: '2026-08-14T09:00:00.000Z',
        }),
      ]);

      const result = await range();
      const carried = result.items.filter((i) => i.carriedFrom);

      expect(carried).toHaveLength(1);
      // Drawn under today while still recorded against the day it was planned
      // for, which is what lets it be ticked from either.
      expect(carried[0]!.shownAt).toBe('2026-08-20T00:00:00.000Z');
      expect(carried[0]!.occurrenceAt).toBe('2026-08-14T09:00:00.000Z');
    });

    it('carries nothing when the span does not reach today', async () => {
      blockFindMany.mockResolvedValue([
        scheduledBlock({
          id: 'olvidada',
          startDate: '2026-07-01T09:00:00.000Z',
          endDate: '2026-07-01T09:00:00.000Z',
        }),
      ]);

      const result = await range('2026-08-01', '2026-08-10');

      expect(result.items.filter((i) => i.carriedFrom)).toHaveLength(0);
    });

    it('agrees with forPeriod about a day inside the span', async () => {
      // A day rendered inside a run of days and the same day rendered on its own
      // must never disagree, which is why both go through one collector.
      blockFindMany.mockResolvedValue([
        scheduledBlock({ id: 'habit', type: 'habit', rrule: 'FREQ=DAILY' }),
      ]);

      const spanned = await range('2026-08-17', '2026-08-23', new Date('2026-08-17T12:00:00.000Z'));
      const alone = await service.forPeriod({
        userId: 'u1',
        workspaceId: 'ws-1',
        period: 'daily',
        date: '2026-08-17',
        now: new Date('2026-08-17T12:00:00.000Z'),
      });

      const fromSpan = spanned.items.filter((i) => i.shownAt.startsWith('2026-08-17'));
      expect(fromSpan.map((i) => i.occurrenceAt)).toEqual(alone.items.map((i) => i.occurrenceAt));
    });

    it('resolves the calendar day in the workspace zone, not in UTC', async () => {
      // Madrid is UTC+2 in August, so a local midnight is 22:00 the day before.
      // Slicing the ISO string on the client would file two hours of every day
      // under the one before it.
      prismaWorkspace.findUnique.mockResolvedValue({ timezone: 'Europe/Madrid' });
      blockFindMany.mockResolvedValue([
        scheduledBlock({ id: 'tarde', startDate: '2026-08-19T22:30:00.000Z' }),
      ]);

      const result = await range('2026-08-17', '2026-08-23');

      expect(result.items[0]!.day).toBe('2026-08-20');
      expect(result.items[0]!.shownAt.slice(0, 10)).toBe('2026-08-19');
    });

    it('carries the parent id, so a view can place it in a tree', async () => {
      blockFindMany.mockResolvedValue([
        { ...scheduledBlock({ id: 'hija' }), parentId: 'padre' },
      ]);

      const result = await range();

      expect(result.items[0]!.parentId).toBe('padre');
    });
  });
});
