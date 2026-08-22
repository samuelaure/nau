import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';
import { BlocksService } from '../blocks/blocks.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  Prisma: {},
}));

const mockParseCompletion = jest.fn();
jest.mock('@nau/llm-client', () => ({
  getClientForFeature: jest.fn(() => ({
    client: { parseCompletion: mockParseCompletion },
    model: 'gpt-4o-mini',
  })),
}));

const REF = new Date('2026-08-20T12:00:00.000Z');

const event = (
  type: string,
  at: string,
  block: { type: string; properties?: Record<string, unknown> },
  metadata: Record<string, unknown> = {},
) => ({
  id: `ev-${at}`,
  type,
  createdAt: new Date(at),
  metadata,
  block: { id: 'b1', properties: {}, ...block },
});

describe('ActivityService', () => {
  let service: ActivityService;
  let blocks: jest.Mocked<BlocksService>;
  let eventFindMany: jest.Mock;
  let blockFindFirst: jest.Mock;

  beforeEach(async () => {
    eventFindMany = jest.fn().mockResolvedValue([]);
    blockFindFirst = jest.fn().mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        {
          provide: PrismaService,
          useValue: {
            event: { findMany: eventFindMany },
            block: { findFirst: blockFindFirst },
          },
        },
        {
          provide: BlocksService,
          useValue: { createInternal: jest.fn().mockResolvedValue({ id: 'activity-1' }) },
        },
      ],
    }).compile();

    service = module.get(ActivityService);
    blocks = module.get(BlocksService);
    mockParseCompletion.mockResolvedValue({ data: { narration: 'Una narración.' } });
  });

  afterEach(() => jest.clearAllMocks());

  describe('buildDay', () => {
    it('renders each event with its local time and subject', async () => {
      eventFindMany.mockResolvedValue([
        event('block.created', '2026-08-20T07:12:00.000Z', {
          type: 'action',
          properties: { text: 'Enviar el informe', priority: 'high' },
        }),
        event('block.completed', '2026-08-20T12:30:00.000Z', {
          type: 'action',
          properties: { text: 'Llamar al fontanero' },
        }),
      ]);

      const day = await service.buildDay('ws-1', 'Europe/Madrid', REF);

      expect(day.factCount).toBe(2);
      // 07:12 UTC is 09:12 in Madrid: the time the person experienced.
      expect(day.timeline).toContain('09:12');
      expect(day.timeline).toContain('Enviar el informe');
      expect(day.timeline).toContain('14:30');
      expect(day.timeline).toContain('completada');
    });

    it('counts bulk types instead of narrating them', async () => {
      // A single mobile sync writes hundreds of capture blocks. A day narrated
      // as "you imported 968 posts" is not a day.
      eventFindMany.mockResolvedValue([
        event('block.created', '2026-08-20T09:00:00.000Z', { type: 'CAPTURE_POST' }),
        event('block.created', '2026-08-20T09:00:01.000Z', { type: 'CAPTURE_POST' }),
        event('block.created', '2026-08-20T10:00:00.000Z', {
          type: 'action',
          properties: { text: 'Una tarea real' },
        }),
      ]);

      const day = await service.buildDay('ws-1', 'UTC', REF);

      expect(day.factCount).toBe(1);
      expect(day.counted).toEqual({ CAPTURE_POST: 2 });
      expect(day.timeline).toContain('Una tarea real');
      expect(day.timeline).not.toContain('CAPTURE_POST:');
    });

    it('never reads the journal back into itself', async () => {
      eventFindMany.mockResolvedValue([
        event('block.created', '2026-08-20T09:00:00.000Z', {
          type: 'journal_entry',
          properties: { summary: 'una entrada personal' },
        }),
        event('block.created', '2026-08-20T09:05:00.000Z', { type: 'journal_summary' }),
        event('block.created', '2026-08-20T09:10:00.000Z', { type: 'journal_activity' }),
      ]);

      const day = await service.buildDay('ws-1', 'UTC', REF);

      expect(day.factCount).toBe(0);
      expect(day.counted).toEqual({});
      expect(day.timeline).not.toContain('una entrada personal');
    });

    it('reads the event log, not the blocks current state', async () => {
      await service.buildDay('ws-1', 'UTC', REF);

      // A block says what is true now; only the log says when it became true.
      expect(eventFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: 'ws-1',
            createdAt: {
              gte: new Date('2026-08-20T00:00:00.000Z'),
              lte: new Date('2026-08-20T23:59:59.999Z'),
            },
          }),
        }),
      );
    });
  });

  describe('generateForDay', () => {
    const oneAction = () =>
      eventFindMany.mockResolvedValue([
        event('block.created', '2026-08-20T09:00:00.000Z', {
          type: 'action',
          properties: { text: 'Una tarea' },
        }),
      ]);

    it('writes nothing on a day with no narratable activity', async () => {
      const result = await service.generateForDay('ws-1', 'UTC', REF);

      expect(result).toMatchObject({ skipped: true });
      expect(blocks.createInternal).not.toHaveBeenCalled();
      expect(mockParseCompletion).not.toHaveBeenCalled();
    });

    it('stores the block as journal_activity, never as a journal entry', async () => {
      oneAction();

      await service.generateForDay('ws-1', 'UTC', REF);

      const call = blocks.createInternal.mock.calls[0]![0];
      expect(call.type).toBe('journal_activity');
    });

    it('keeps the deterministic timeline alongside the prose', async () => {
      oneAction();

      await service.generateForDay('ws-1', 'UTC', REF);

      const props = blocks.createInternal.mock.calls[0]![0].properties as Record<string, unknown>;
      expect(props.summary).toBe('Una narración.');
      expect(props.raw).toContain('Una tarea');
    });

    it('falls back to the timeline when the model is unavailable', async () => {
      oneAction();
      mockParseCompletion.mockRejectedValue(new Error('no provider'));

      await service.generateForDay('ws-1', 'UTC', REF);

      // The facts were never the model's to produce, so an outage costs polish
      // and nothing else.
      const props = blocks.createInternal.mock.calls[0]![0].properties as Record<string, unknown>;
      expect(props.summary).toContain('Una tarea');
    });

    it('dates the block at the end of the local day, so it closes it', async () => {
      oneAction();

      await service.generateForDay('ws-1', 'Europe/Madrid', REF);

      const props = blocks.createInternal.mock.calls[0]![0].properties as Record<string, unknown>;
      expect(props.date).toBe('2026-08-20T21:59:59.999Z');
    });

    it('does not write a second block for a day it already covered', async () => {
      oneAction();
      blockFindFirst.mockResolvedValue({ id: 'already-there' });

      const result = await service.generateForDay('ws-1', 'UTC', REF);

      expect(result).toMatchObject({ cached: true, blockId: 'already-there' });
      expect(blocks.createInternal).not.toHaveBeenCalled();
    });

    it('gives the model the timeline and forbids it adding anything', async () => {
      oneAction();

      await service.generateForDay('ws-1', 'UTC', REF);

      const [{ messages }] = mockParseCompletion.mock.calls[0]!;
      expect(messages[1].content).toContain('Una tarea');
      expect(messages[0].content).toMatch(/no añadas/i);
      expect(messages[0].content).toMatch(/no infieras/i);
    });
  });
});
