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
    exceptions: over.exceptions ?? [],
  },
});

describe('AgendaService — one list for actions and habits', () => {
  let service: AgendaService;
  let blockFindMany: jest.Mock;
  let eventFindMany: jest.Mock;
  let blocks: jest.Mocked<BlocksService>;
  let events: jest.Mocked<BlockEventsService>;

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
  });

  afterEach(() => jest.clearAllMocks());

  const agenda = (period: any = 'daily', date = MONDAY) =>
    service.forPeriod({ userId: 'u1', workspaceId: 'ws-1', period, date });

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
});
