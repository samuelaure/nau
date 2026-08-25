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
  activity?: unknown[];
  sideBlocks?: unknown[];
  summaries?: unknown[];
};

const activityBlock = (dateIso: string, text: string) => ({
  id: `a-${dateIso}`,
  type: 'journal_activity',
  createdAt: new Date(dateIso),
  properties: { date: dateIso, raw: text, summary: text, source: 'activity_synthesis' },
});

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
      if (where.type === 'journal_activity') return Promise.resolve(f.activity ?? []);
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
            // Every period boundary is resolved in the workspace's zone. These
            // tests pin it to UTC so the expected instants stay readable.
            workspace: {
              findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn(() => 'secret') } },
        {
          provide: BlocksService,
          useValue: {
            createInternal: jest.fn().mockResolvedValue({ id: 'new-summary' }),
            updateInternal: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(JournalService);
    blocksService = module.get(BlocksService);

    mockParseCompletion.mockResolvedValue({
      data: { synthesis: 's', digest: 'd', summary: 'r', highlights: [] },
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

    it('prefers a hand-made correction over the original capture', async () => {
      load({
        entries: [
          entry('2026-08-20T09:12:00.000Z', {
            raw: 'lo que el microfono oyo',
            summary: 'lo que yo quise decir',
            editedAt: '2026-08-21T10:00:00.000Z',
          }),
        ],
      });

      const { user } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(user).toContain('lo que yo quise decir');
      expect(user).not.toContain('lo que el microfono oyo');
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

  /**
   * A period is built from captured experiences and nothing else.
   *
   * Recorded activity, tasks and inbox captures used to be read in as
   * supporting context, and the result opened by telling its author they had
   * created two tasks named "sin título" — the system's own noise in the place
   * where a person's life was meant to be. These tests hold that line.
   */
  describe('only what the person captured', () => {
    it('never reads the activity the system recorded about itself', async () => {
      load({
        entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'lo que dije' })],
        activity: [activityBlock('2026-08-20T23:59:59.999Z', 'Creé dos tareas y completé una.')],
      });

      const { user } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(user).toContain('lo que dije');
      expect(user).not.toContain('Creé dos tareas y completé una.');
    });

    it('does not query for activity, tasks or captures at all', async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'lo que dije' })] });

      await service.generateSummary('daily', '2026-08-20', '2026-08-20', 'ws-1');

      const typesQueried = findMany.mock.calls.map((c) => c[0].where.type);
      expect(typesQueried).not.toContain('journal_activity');
      // `{ in: [...] }` was the action/content_idea query.
      expect(typesQueried.some((t) => t && typeof t === 'object' && 'in' in t)).toBe(false);
    });

    it('writes nothing for a day whose only trace is system activity', async () => {
      load({ activity: [activityBlock('2026-08-20T23:59:59.999Z', 'Completé tres tareas.')] });

      const result = await service.generateSummary('daily', '2026-08-20', '2026-08-20', 'ws-1');

      // Silence is the honest answer. A day nobody wrote about is not a day to
      // narrate from event rows.
      expect(result).toMatchObject({ skipped: true });
      expect(blocksService.createInternal).not.toHaveBeenCalled();
    });

    it('does not feed activity into the levels that read summaries', async () => {
      load({
        activity: [activityBlock('2026-07-04T23:59:59.999Z', 'Actividad de julio.')],
        summaries: [summary('daily', '2026-07-04T00:00:00.000Z', '2026-07-04T23:59:59.999Z')],
      });

      const { user } = await promptFor('monthly', '2026-07-01', '2026-07-31');

      expect(user).not.toContain('Actividad de julio.');
    });
  });

  /**
   * The derived entry is read in the app; Telegram gets a short notice about
   * it. Sending the entry itself is what put a 15,669-character message in
   * front of Telegram's 4,096 limit and crash-looped Zazŭ 1,215 times.
   */
  describe('the entry is read in the app, the digest is what is sent', () => {
    const generated = async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'lo que viví' })] });
      mockParseCompletion.mockResolvedValueOnce({
        data: {
          synthesis: 'el día entero, homogeneizado, largo'.repeat(50),
          digest: 'Hoy fue sobre dinero y sobre reconectar con la familia.',
          summary: 'dinero y familia',
          highlights: [],
        },
      });
      await service.generateSummary('daily', '2026-08-20', '2026-08-20', 'ws-1');
      return blocksService.createInternal.mock.calls[0]![0].properties as Record<string, unknown>;
    };

    it('sends the digest, not the derived entry', async () => {
      const props = await generated();
      expect(props.deliveryText).toBe('Hoy fue sobre dinero y sobre reconectar con la familia.');
    });

    it('never puts the full entry into the delivery text', async () => {
      const props = await generated();
      expect(props.deliveryText).not.toContain('el día entero, homogeneizado');
      expect((props.deliveryText as string).length).toBeLessThan(4096);
    });

    it('keeps the full entry on the block, which is what the app reads', async () => {
      const props = await generated();
      expect(props.synthesis).toContain('el día entero, homogeneizado');
    });

    it('stores the digest too, so what was sent can be read back later', async () => {
      const props = await generated();
      expect(props.digest).toBe('Hoy fue sobre dinero y sobre reconectar con la familia.');
    });

    it('asks the model for a digest meant for a phone', async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'x' })] });
      const { system } = await promptFor('daily', '2026-08-20', '2026-08-20');
      expect(system).toContain('"digest"');
      expect(system).toContain('móvil');
      // It must be clear it replaces nothing — the app holds the real thing.
      expect(system).toContain('Nunca lo sustituye');
    });
  });

  describe('an interpretation, not a summary', () => {
    it('tells the model to homogenise rather than condense', async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'x' })] });

      const { system } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(system).toContain('NO es un resumen');
      expect(system).toContain('UNA sola experiencia continua');
    });

    it('asks for the person\'s own words, which is what makes it recognisable', async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'x' })] });

      const { system } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(system).toContain('primera persona');
      expect(system).toContain('con las palabras de la persona');
    });

    it('forbids the model from commenting on what was lived', async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'x' })] });

      const { system } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(system).toContain('No opines');
      expect(system).toContain('no eres un observador');
    });

    it('weights each experience by what it meant rather than evenly', async () => {
      load({ entries: [entry('2026-08-20T09:12:00.000Z', { raw: 'x' })] });

      const { system } = await promptFor('daily', '2026-08-20', '2026-08-20');

      expect(system).toContain('el espacio que merece');
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
            equals: '2026-07-01T00:00:00.000Z',
          },
        },
        {
          properties: {
            path: ['periodEnd'],
            equals: '2026-07-31T23:59:59.999Z',
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
