import { Test, TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import { ConfigService } from '@nestjs/config';
import { JournalService } from './journal.service';
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

jest.mock('@nau/auth', () => ({ signServiceToken: jest.fn().mockResolvedValue('tok') }));
jest.mock('axios', () => ({ post: jest.fn().mockResolvedValue({ data: {} }) }));

/** The rows the mocked findMany should answer with, keyed by what was asked for. */
type Fixture = {
  entries?: unknown[];
  sideBlocks?: unknown[];
  summaries?: unknown[];
};

const entry = (dateIso: string, props: Record<string, unknown>) => ({
  id: `e-${dateIso}`,
  type: 'journal_entry',
  createdAt: new Date(dateIso),
  properties: { date: dateIso, ...props },
});

const summary = (periodType: string, start: string, end: string) => ({
  id: `s-${periodType}-${start}`,
  type: 'journal_summary',
  createdAt: new Date(end),
  properties: {
    periodType,
    periodStart: start,
    periodEnd: end,
    summary: `qué pasó en el ${periodType} ${start}`,
    synthesis: `qué significó el ${periodType} ${start}`,
  },
});

describe('JournalService — what each period reads', () => {
  let service: JournalService;
  let blocksService: jest.Mocked<BlocksService>;
  let findMany: jest.Mock;
  let findFirst: jest.Mock;

  /**
   * Routes each findMany to the right slice of the fixture by inspecting the
   * `where` the service built. That is deliberate: the assertions below are
   * about which query the service issues, so the mock has to distinguish them.
   */
  const load = (f: Fixture) => {
    findMany.mockImplementation(({ where }: any) => {
      if (where.type === 'journal_entry') return Promise.resolve(f.entries ?? []);
      if (where.type === 'journal_summary') {
        const wanted = where.AND?.[0]?.properties?.equals;
        return Promise.resolve(
          (f.summaries ?? []).filter((s: any) => s.properties.periodType === wanted),
        );
      }
      if (where.type?.in) return Promise.resolve(f.sideBlocks ?? []);
      return Promise.resolve([]);
    });
  };

  const promptFor = async (
    periodType: any,
    start: string,
    end: string,
  ): Promise<{ system: string; user: string }> => {
    await service.generateSummary(periodType, start, end, 'ws-1');
    const call = mockParseCompletion.mock.calls.at(-1)![0];
    return { system: call.messages[0].content, user: call.messages[1].content };
  };

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([]);
    findFirst = jest.fn().mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        {
          provide: PrismaService,
          useValue: {
            block: { findMany, findFirst },
            relation: { createMany: jest.fn() },
            workspaceMember: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn(() => 'secret') } },
        {
          provide: BlocksService,
          useValue: { createInternal: jest.fn().mockResolvedValue({ id: 'new-summary' }) },
        },
      ],
    }).compile();

    service = module.get(JournalService);
    blocksService = module.get(BlocksService);

    mockParseCompletion.mockResolvedValue({
      data: { synthesis: 's', summary: 'r', highlights: [] },
    });
  });

  afterEach(() => jest.clearAllMocks());

  describe('daily', () => {
    it('reads the raw capture of every entry in the day', async () => {
      load({
        entries: [
          entry('2026-08-20T09:12:00.000Z', { raw: 'lo que dije de verdad', summary: 'limpio' }),
          entry('2026-08-20T18:40:00.000Z', { raw: 'segunda nota cruda', summary: 'limpio 2' }),
        ],
      });

      const { user } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(user).toContain('lo que dije de verdad');
      expect(user).toContain('segunda nota cruda');
    });

    it('reads only one of the two stored forms, not both', async () => {
      load({
        entries: [
          entry('2026-08-20T09:12:00.000Z', { raw: 'la forma cruda', summary: 'la forma limpia' }),
        ],
      });

      const { user } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(user).toContain('la forma cruda');
      expect(user).not.toContain('la forma limpia');
    });

    it('falls back to the cleaned text for entries written before raw existed', async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { summary: 'sólo tengo el limpio' })] });

      const { user } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(user).toContain('sólo tengo el limpio');
    });

    it('selects entries by when they were captured, not when they were stored', async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'x' })] });

      await service.generateSummary('daily', '2026-08-20', '2026-08-20', 'ws-1');

      const entryQuery = findMany.mock.calls.find((c) => c[0].where.type === 'journal_entry')![0];
      expect(entryQuery.where.AND).toEqual([
        { properties: { path: ['date'], gte: expect.any(String) } },
        { properties: { path: ['date'], lte: expect.any(String) } },
      ]);
      expect(entryQuery.where.createdAt).toBeUndefined();
    });

    it('never asks for summaries of its own entries', async () => {
      load({
        entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'x' })],
        summaries: [summary('daily', '2026-08-20T00:00:00.000Z', '2026-08-20T23:59:59.999Z')],
      });

      const { user } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(user).not.toContain('qué pasó en el daily');
    });
  });

  describe('weekly', () => {
    it('reads the entries of its days, not the daily summaries', async () => {
      load({
        entries: [entry('2026-08-18T10:00:00.000Z', { raw: 'la nota del martes' })],
        summaries: [summary('daily', '2026-08-18T00:00:00.000Z', '2026-08-18T23:59:59.999Z')],
      });

      const { user } = await promptFor('weekly', '2026-08-17', '2026-08-23');

      expect(user).toContain('la nota del martes');
      expect(user).not.toContain('qué pasó en el daily');
    });
  });

  describe('monthly', () => {
    it('reads the daily summaries of the month', async () => {
      load({
        entries: [entry('2026-07-04T10:00:00.000Z', { raw: 'una entrada suelta de julio' })],
        summaries: [
          summary('daily', '2026-07-04T00:00:00.000Z', '2026-07-04T23:59:59.999Z'),
          summary('weekly', '2026-07-01T00:00:00.000Z', '2026-07-05T23:59:59.999Z'),
        ],
      });

      const { user } = await promptFor('monthly', '2026-07-01', '2026-07-31');

      expect(user).toContain('qué pasó en el daily');
      // Not the weeks, and not the entries themselves: one level down, only.
      expect(user).not.toContain('qué pasó en el weekly');
      expect(user).not.toContain('una entrada suelta de julio');
    });
  });

  describe('trimester', () => {
    it('reads the weekly summaries of the quarter', async () => {
      load({
        summaries: [
          summary('weekly', '2026-07-06T00:00:00.000Z', '2026-07-12T23:59:59.999Z'),
          summary('daily', '2026-07-06T00:00:00.000Z', '2026-07-06T23:59:59.999Z'),
        ],
      });

      const { user } = await promptFor('trimester', '2026-07-01', '2026-09-30');

      expect(user).toContain('qué pasó en el weekly');
      expect(user).not.toContain('qué pasó en el daily');
    });
  });

  describe('yearly', () => {
    it('reads the monthly summaries of the year', async () => {
      load({
        summaries: [
          summary('monthly', '2026-07-01T00:00:00.000Z', '2026-07-31T23:59:59.999Z'),
          summary('trimester', '2026-07-01T00:00:00.000Z', '2026-09-30T23:59:59.999Z'),
        ],
      });

      const { user } = await promptFor('yearly', '2026-01-01', '2026-12-31');

      expect(user).toContain('qué pasó en el monthly');
      expect(user).not.toContain('qué pasó en el trimester');
    });
  });

  describe('guards', () => {
    it('writes nothing when the period has no input', async () => {
      load({});

      const result = await service.generateSummary('monthly', '2026-07-01', '2026-07-31', 'ws-1');

      expect(result).toMatchObject({ skipped: true });
      expect(mockParseCompletion).not.toHaveBeenCalled();
      expect(blocksService.createInternal).not.toHaveBeenCalled();
    });

    it('excludes soft-deleted summaries from what it reads', async () => {
      load({ summaries: [summary('daily', '2026-07-04T00:00:00.000Z', '2026-07-04T23:59:59.999Z')] });

      await service.generateSummary('monthly', '2026-07-01', '2026-07-31', 'ws-1');

      const q = findMany.mock.calls.find((c) => c[0].where.type === 'journal_summary')![0];
      expect(q.where.deletedAt).toBeNull();
    });

    it('matches an existing summary on the period it covers, not on when it was written', async () => {
      findFirst.mockResolvedValue({ id: 'already-there' });

      const result = await service.generateSummary('monthly', '2026-07-01', '2026-07-31', 'ws-1');

      expect(result).toMatchObject({ cached: true, blockId: 'already-there' });
      const where = findFirst.mock.calls[0]![0].where;
      expect(where.AND).toEqual([
        { properties: { path: ['periodType'], equals: 'monthly' } },
        {
          properties: {
            path: ['periodStart'],
            equals: dayjs('2026-07-01').startOf('day').toISOString(),
          },
        },
        {
          properties: {
            path: ['periodEnd'],
            equals: dayjs('2026-07-31').endOf('day').toISOString(),
          },
        },
      ]);
      expect(where.createdAt).toBeUndefined();
    });

    it('records on the summary what it was built from', async () => {
      load({ summaries: [summary('daily', '2026-07-04T00:00:00.000Z', '2026-07-04T23:59:59.999Z')] });

      await service.generateSummary('monthly', '2026-07-01', '2026-07-31', 'ws-1');

      const props = blocksService.createInternal.mock.calls[0]![0].properties as Record<string, unknown>;
      expect(props.sourceType).toBe('daily');
      expect(props.sourceCount).toBe(1);
    });
  });

  describe('prompt', () => {
    it('forbids writing anything the record does not contain', async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'x' })] });

      const { system } = await promptFor('daily', '2026-08-20', '2026-08-20');

      // The absence of this instruction is how 95 summaries of empty periods
      // came to describe events that never happened.
      expect(system).toMatch(/no puede no estar|no infieras/i);
    });

    it('tells the model the period it is covering', async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'x' })] });

      const { system } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(system).toContain('20 de agosto de 2026');
    });
  });
});
