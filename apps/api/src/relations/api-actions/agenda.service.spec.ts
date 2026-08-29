import { Test, TestingModule } from '@nestjs/testing';
import { AgendaService } from './agenda.service';
import { BlocksService } from '../../blocks/blocks.service';
import { ScopedPrismaService } from '../../core/tenancy/scoped-prisma.service';
import { BlockEventsService } from '../../blocks/block-events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceTimeService } from '../../time/workspace-time.service';
import { OccurrencesService } from '../../time/occurrences.service';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  Prisma: {},
}));

/**
 * The agenda is now the half of this that is about MEANING.
 *
 * Time answers when things occur; this service decides what a row is, whether
 * it is done, how long it should take, and where it is drawn. The split is
 * visible in these tests: occurrences arrive from a mocked Time module, and
 * everything asserted here is something only Actions could know.
 */

const MONDAY = '2026-08-17';

/** A block as Actions sees it — properties and a planning identity. */
const plannedBlock = (over: {
  id: string;
  type?: string;
  title?: string;
  scale?: string;
  from?: string;
  to?: string;
  recurrence?: string | null;
  sortOrder?: number;
  estimateMinutes?: number;
  parentId?: string | null;
}) => ({
  id: over.id,
  type: over.type ?? 'action',
  parentId: over.parentId ?? null,
  properties: {
    text: over.title ?? over.id,
    sortOrder: over.sortOrder ?? 0,
    ...(over.estimateMinutes ? { estimateMinutes: over.estimateMinutes } : {}),
  },
  planning: {
    id: `pl-${over.id}`,
    blockId: over.id,
    system: 'gregorian',
    scale: over.scale ?? 'day',
    anchor: new Date(over.from ?? '2026-08-17T00:00:00.000Z'),
    from: new Date(over.from ?? '2026-08-17T00:00:00.000Z'),
    to: new Date(over.to ?? '2026-08-18T00:00:00.000Z'),
    recurrence: over.recurrence ?? null,
    recurrenceTimezone: null,
    recurrenceMode: 'FIXED',
  },
});

/** What Time would report for a block, at one instant. */
const occurrenceOf = (
  block: ReturnType<typeof plannedBlock>,
  at: string,
  over: Partial<{ projected: boolean; moved: boolean; overdue: number }> = {},
) => ({
  blockId: block.id,
  occurrenceAt: new Date(at),
  effectiveAt: new Date(at),
  moved: over.moved ?? false,
  projected: over.projected ?? false,
  system: 'gregorian',
  scale: block.planning.scale,
  from: block.planning.from,
  to: block.planning.to,
  recurring: Boolean(block.planning.recurrence),
  overdue: over.overdue ?? 0,
});

describe('AgendaService — meaning on top of Time', () => {
  let service: AgendaService;
  let blockFindMany: jest.Mock;
  let eventFindMany: jest.Mock;
  let planningFindUnique: jest.Mock;
  let blocks: jest.Mocked<BlocksService>;
  let events: jest.Mocked<BlockEventsService>;
  let inView: jest.Mock;

  beforeEach(async () => {
    blockFindMany = jest.fn().mockResolvedValue([]);
    eventFindMany = jest.fn().mockResolvedValue([]);
    planningFindUnique = jest.fn().mockResolvedValue({ recurrence: null });
    inView = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgendaService,
        {
          provide: PrismaService,
          useValue: {
            block: { findMany: blockFindMany, update: jest.fn() },
            event: { findMany: eventFindMany },
            planning: { findUnique: planningFindUnique },
            $transaction: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: BlocksService,
          useValue: { update: jest.fn() },
        },
        {
          // Authorization is the tenancy layer's job now, not the block
          // service's — the agenda keeps BlocksService only for the mutation.
          provide: ScopedPrismaService,
          useValue: {
            assertMembership: jest.fn(),
            assertBlockAccess: jest.fn().mockResolvedValue({ id: 'b1', workspaceId: 'ws-1' }),
          },
        },
        { provide: BlockEventsService, useValue: { record: jest.fn() } },
        {
          // Pinned to UTC with an ISO-Monday week so expected instants stay
          // readable. Which day opens a week is Time's answer, not this one's.
          provide: WorkspaceTimeService,
          useValue: {
            resolveContext: jest
              .fn()
              .mockResolvedValue({ timezone: 'UTC', config: { firstDayOfWeek: 1 } }),
          },
        },
        { provide: OccurrencesService, useValue: { inView } },
      ],
    }).compile();

    service = module.get(AgendaService);
    blocks = module.get(BlocksService);
    events = module.get(BlockEventsService);
  });

  afterEach(() => jest.clearAllMocks());

  /**
   * Wires a set of blocks and the occurrences Time would report for them.
   *
   * The block lookup answers by query rather than blindly, because `collect`
   * makes two different ones: the blocks Time reported, and separately the
   * overdue candidates for carry-over. A mock that returned everything to both
   * would let the same block arrive twice and hide a real duplicate bug.
   */
  const given = (
    entries: { block: ReturnType<typeof plannedBlock>; at: string; over?: object }[],
  ) => {
    const all = entries.map((e) => e.block);
    blockFindMany.mockImplementation((args: any) => {
      const ids = args?.where?.id?.in as string[] | undefined;
      if (ids) return Promise.resolve(all.filter((b) => ids.includes(b.id)));
      // The carry query, which asks for overdue one-offs rather than by id.
      return Promise.resolve([]);
    });
    inView.mockResolvedValue(
      entries.map((e) => occurrenceOf(e.block, e.at, e.over as never)),
    );
  };

  /** The same, for tests that drive `inView` directly. */
  const givenBlocks = (all: ReturnType<typeof plannedBlock>[]) => {
    blockFindMany.mockImplementation((args: any) => {
      const ids = args?.where?.id?.in as string[] | undefined;
      if (ids) return Promise.resolve(all.filter((b) => ids.includes(b.id)));
      return Promise.resolve([]);
    });
  };

  const agenda = (scale = 'day', date = MONDAY, now = new Date('2026-08-17T12:00:00.000Z')) =>
    service.forPeriod({ userId: 'u1', workspaceId: 'ws-1', scale, date, now });

  it('puts a habit and an action in the same list, ordered together', async () => {
    const task = plannedBlock({ id: 'task', title: 'Enviar el informe', sortOrder: 1 });
    const habit = plannedBlock({
      id: 'habit',
      type: 'habit',
      title: 'Meditar',
      recurrence: 'FREQ=DAILY',
      sortOrder: 0,
    });
    given([
      { block: task, at: '2026-08-17T09:00:00.000Z' },
      { block: habit, at: '2026-08-17T07:00:00.000Z' },
    ]);

    const result = await agenda();

    // Ordered by sortOrder, so dragging a habit above a task means it comes
    // first every day rather than only today.
    expect(result.items.map((i) => i.blockId)).toEqual(['habit', 'task']);
  });

  it('calls anything with a recurrence a habit, without storing the type', async () => {
    const block = plannedBlock({ id: 'h', type: 'action', recurrence: 'FREQ=DAILY' });
    given([{ block, at: '2026-08-17T08:00:00.000Z' }]);

    const result = await agenda();

    // Adding a frequency turns an action into a habit and removing it turns it
    // back, with no write and no second transition to maintain.
    expect(result.items[0]!.isHabit).toBe(true);
    expect(result.items[0]!.recurring).toBe(true);
  });

  it('marks an item planned above day scale as spanning its period', async () => {
    const block = plannedBlock({
      id: 'mes',
      scale: 'month',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-09-01T00:00:00.000Z',
    });
    given([{ block, at: '2026-08-01T00:00:00.000Z' }]);

    const result = await agenda('month', '2026-08-15');

    expect(result.items[0]!.spansPeriod).toBe(true);
  });

  describe('completion, read from the event log', () => {
    it('reads completion per occurrence, not per block', async () => {
      const block = plannedBlock({ id: 'h', type: 'habit', recurrence: 'FREQ=DAILY' });
      givenBlocks([block]);
      inView.mockResolvedValue([
        occurrenceOf(block, '2026-08-17T08:00:00.000Z'),
        occurrenceOf(block, '2026-08-18T08:00:00.000Z'),
      ]);
      eventFindMany.mockResolvedValue([
        {
          type: 'occurrence.completed',
          blockId: 'h',
          metadata: { occurrenceAt: '2026-08-17T08:00:00.000Z' },
        },
      ]);

      const result = await agenda();

      expect(result.items.map((i) => i.done)).toEqual([true, false]);
    });

    it('lets a later reopening undo an earlier completion', async () => {
      const block = plannedBlock({ id: 'h', type: 'habit', recurrence: 'FREQ=DAILY' });
      given([{ block, at: '2026-08-17T08:00:00.000Z' }]);
      eventFindMany.mockResolvedValue([
        {
          type: 'occurrence.completed',
          blockId: 'h',
          metadata: { occurrenceAt: '2026-08-17T08:00:00.000Z' },
        },
        {
          type: 'occurrence.reopened',
          blockId: 'h',
          metadata: { occurrenceAt: '2026-08-17T08:00:00.000Z' },
        },
      ]);

      const result = await agenda();

      expect(result.items[0]!.done).toBe(false);
    });

    it('records against the predicted instant, not the moment of ticking', async () => {
      await service.setCompletion({
        userId: 'u1',
        blockId: 'b1',
        occurrenceAt: '2026-08-16T08:00:00.000Z',
        done: true,
      });

      // Catching up on yesterday's habit must be recorded against yesterday, or
      // the streak describes the wrong days.
      expect(events.record).toHaveBeenCalledWith(
        'occurrence.completed',
        expect.anything(),
        { occurrenceAt: '2026-08-16T08:00:00.000Z' },
        'u1',
      );
    });

    it('mirrors state onto the block for a one-off, so the rest of the app sees it', async () => {
      planningFindUnique.mockResolvedValue({ recurrence: null });

      await service.setCompletion({
        userId: 'u1',
        blockId: 'b1',
        occurrenceAt: '2026-08-17T08:00:00.000Z',
        done: true,
      });

      expect(blocks.update).toHaveBeenCalledWith('u1', 'b1', {
        properties: { status: 'done' },
      });
    });

    it('leaves a recurring block alone, because a habit is never done', async () => {
      planningFindUnique.mockResolvedValue({ recurrence: 'FREQ=DAILY' });

      await service.setCompletion({
        userId: 'u1',
        blockId: 'b1',
        occurrenceAt: '2026-08-17T08:00:00.000Z',
        done: true,
      });

      expect(blocks.update).not.toHaveBeenCalled();
    });
  });

  describe('the counts a view shows above the list', () => {
    it('totals only what is still pending, and counts what has no estimate', async () => {
      const done = plannedBlock({ id: 'done', estimateMinutes: 30 });
      const pending = plannedBlock({ id: 'pending', estimateMinutes: 45 });
      const noEstimate = plannedBlock({ id: 'vague' });
      givenBlocks([done, pending, noEstimate]);
      inView.mockResolvedValue([
        occurrenceOf(done, '2026-08-17T08:00:00.000Z'),
        occurrenceOf(pending, '2026-08-17T09:00:00.000Z'),
        occurrenceOf(noEstimate, '2026-08-17T10:00:00.000Z'),
      ]);
      eventFindMany.mockResolvedValue([
        {
          type: 'occurrence.completed',
          blockId: 'done',
          metadata: { occurrenceAt: '2026-08-17T08:00:00.000Z' },
        },
      ]);

      const result = await agenda();

      expect(result.plannedMinutes).toBe(45);
      expect(result.unestimatedCount).toBe(1);
    });

    it('keeps projections out of the planned time', async () => {
      const block = plannedBlock({
        id: 'h',
        type: 'habit',
        recurrence: 'FREQ=DAILY',
        estimateMinutes: 20,
      });
      givenBlocks([block]);
      inView.mockResolvedValue([
        occurrenceOf(block, '2026-08-17T08:00:00.000Z'),
        occurrenceOf(block, '2026-08-18T08:00:00.000Z', { projected: true }),
      ]);

      const result = await agenda();

      // A guess is not a commitment, so it does not consume the day's budget.
      expect(result.plannedMinutes).toBe(20);
    });
  });

  describe('carry-over — derived, never written', () => {
    const yesterday = () =>
      plannedBlock({
        id: 'ayer',
        from: '2026-08-16T00:00:00.000Z',
        to: '2026-08-17T00:00:00.000Z',
      });

    it('shows an unfinished action in the period being lived now', async () => {
      inView.mockResolvedValue([]);
      blockFindMany.mockResolvedValue([yesterday()]);

      const result = await agenda('day', MONDAY);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.carriedFrom).toBe('2026-08-16T00:00:00.000Z');
      expect(result.carriedCount).toBe(1);
    });

    it('counts the periods it has been carried, so it cannot be ignored forever', async () => {
      inView.mockResolvedValue([]);
      blockFindMany.mockResolvedValue([
        plannedBlock({
          id: 'viejo',
          from: '2026-08-14T00:00:00.000Z',
          to: '2026-08-15T00:00:00.000Z',
        }),
      ]);

      const result = await agenda('day', MONDAY);

      expect(result.items[0]!.carriedPeriods).toBe(3);
    });

    it('does not carry into a past period that is merely being looked at', async () => {
      inView.mockResolvedValue([]);
      blockFindMany.mockResolvedValue([yesterday()]);

      // Looking back at last Tuesday should show last Tuesday, not last Tuesday
      // plus everything still open since.
      const result = await agenda('day', '2026-08-20', new Date('2026-08-25T12:00:00.000Z'));

      expect(result.items).toHaveLength(0);
    });

    it('stops carrying once it is done', async () => {
      inView.mockResolvedValue([]);
      blockFindMany.mockResolvedValue([yesterday()]);
      eventFindMany.mockResolvedValue([
        {
          type: 'occurrence.completed',
          blockId: 'ayer',
          metadata: { occurrenceAt: '2026-08-16T00:00:00.000Z' },
        },
      ]);

      const result = await agenda('day', MONDAY);

      expect(result.items).toHaveLength(0);
    });

    it('carries at the scale it was planned at, never into today', async () => {
      inView.mockResolvedValue([]);
      // A month-level item that went unfinished belongs in the current month,
      // not in today's list — putting it there would defeat the deferral.
      blockFindMany.mockResolvedValue([]);

      const daily = await agenda('day', '2026-08-23', new Date('2026-08-23T12:00:00.000Z'));

      expect(daily.items).toHaveLength(0);
      // The month query asks for scale: 'month', which the day query never does.
      expect(blockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            planning: { is: expect.objectContaining({ scale: 'day' }) },
          }),
        }),
      );
    });

    it('never carries a habit: a missed one does not accumulate', async () => {
      inView.mockResolvedValue([]);
      blockFindMany.mockResolvedValue([]);

      await agenda('day', MONDAY);

      // The carry query excludes anything with a recurrence, because a missed
      // habit is simply missed — it does not pile up.
      expect(blockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            planning: { is: expect.objectContaining({ recurrence: null }) },
          }),
        }),
      );
    });

    it('counts manual deferrals separately from the automatic carry', async () => {
      inView.mockResolvedValue([]);
      blockFindMany.mockResolvedValue([yesterday()]);
      eventFindMany.mockResolvedValue([
        { type: 'block.rescheduled', blockId: 'ayer', metadata: {} },
        { type: 'block.rescheduled', blockId: 'ayer', metadata: {} },
      ]);

      const result = await agenda('day', MONDAY);

      // Two different facts: how many times the person moved it by hand, and
      // how many periods it has drifted on its own.
      expect(result.items[0]!.rescheduledCount).toBe(2);
      expect(result.items[0]!.carriedPeriods).toBe(1);
    });
  });

  describe('what Time is asked, and what Actions decides', () => {
    it('asks Time for the view, and never computes occurrences itself', async () => {
      await agenda('week', MONDAY);

      expect(inView).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1', scale: 'week' }),
      );
    });

    it('keeps non-agenda types out, which is Actions’ business and not Time’s', async () => {
      const note = plannedBlock({ id: 'nota', type: 'note' });
      // Time reports it because it is planned; Actions drops it because a note
      // is not something you do.
      blockFindMany.mockResolvedValue([]);
      inView.mockResolvedValue([occurrenceOf(note, '2026-08-17T08:00:00.000Z')]);

      const result = await agenda();

      expect(result.items).toHaveLength(0);
    });

    it('carries the parent id, so a view can place it in a tree', async () => {
      const child = plannedBlock({ id: 'hijo', parentId: 'padre' });
      given([{ block: child, at: '2026-08-17T08:00:00.000Z' }]);

      const result = await agenda();

      expect(result.items[0]!.parentId).toBe('padre');
    });

    it('reports how late an anchored habit is, as Time measured it', async () => {
      const block = plannedBlock({ id: 'afeitar', type: 'habit', recurrence: 'FREQ=DAILY;INTERVAL=3' });
      givenBlocks([block]);
      inView.mockResolvedValue([
        occurrenceOf(block, '2026-08-14T08:00:00.000Z', { overdue: 1 }),
      ]);

      const result = await agenda();

      // Lateness is a property of the rhythm, which Time owns. Actions only
      // passes it through to whatever maps it onto colour.
      expect(result.items[0]!.overdue).toBe(1);
    });
  });

  describe('next actions — what has no period at all', () => {
    it('returns blocks with no planning, which is where a capture waits', async () => {
      blockFindMany.mockResolvedValue([
        {
          id: 'idea',
          type: 'action',
          parentId: null,
          properties: { text: 'Llamar al fontanero' },
          createdAt: new Date('2026-08-10T10:00:00.000Z'),
        },
      ]);

      const result = await service.nextActions({ userId: 'u1', workspaceId: 'ws-1' });

      expect(result.items).toHaveLength(1);
      expect(blockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ planning: { is: null } }),
        }),
      );
    });
  });

  describe('forRange — many periods in one request', () => {
    it('asks Time once for the whole span', async () => {
      await service.forRange({
        userId: 'u1',
        workspaceId: 'ws-1',
        from: '2026-08-17',
        to: '2026-08-23',
        scale: 'day',
        now: new Date('2026-08-17T12:00:00.000Z'),
      });

      // One request for the run of days on screen, not one per day.
      expect(inView).toHaveBeenCalledTimes(1);
    });

    it('tells each row which day to draw it under', async () => {
      const block = plannedBlock({ id: 'x' });
      given([{ block, at: '2026-08-19T08:00:00.000Z' }]);

      const result = await service.forRange({
        userId: 'u1',
        workspaceId: 'ws-1',
        from: '2026-08-17',
        to: '2026-08-23',
        scale: 'day',
        now: new Date('2026-08-17T12:00:00.000Z'),
      });

      // The day is resolved server-side: an instant only becomes a day once you
      // know where it is being lived, and slicing an ISO string answers for UTC.
      expect(result.items[0]!.day).toBe('2026-08-19');
    });
  });
});
