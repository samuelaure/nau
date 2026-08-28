import { Test, TestingModule } from '@nestjs/testing';
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
    model: 'gpt-4o',
  })),
}));

const entry = (id: string, date: string, text: string) => ({
  id,
  type: 'journal_entry',
  createdAt: new Date(date),
  properties: { text, date, source: 'zazu', originFormat: 'voice' },
});

const synthesis = (id: string, from: string, to: string) => ({
  id,
  type: 'journal_synthesis',
  createdAt: new Date(from),
  properties: {
    from,
    to,
    synthesis: `la síntesis de ${id}`,
    reflection: `la reflexión de ${id}`,
  },
});

describe('JournalService', () => {
  let service: JournalService;
  let blocksService: jest.Mocked<BlocksService>;
  let findMany: jest.Mock;
  let findUnique: jest.Mock;

  /** The properties of the block the service wrote. */
  const written = () =>
    blocksService.createInternal.mock.calls[0]![0].properties as Record<string, any>;

  const generate = (overrides: Partial<Parameters<JournalService['generateSynthesis']>[0]> = {}) =>
    service.generateSynthesis({
      workspaceId: 'ws-1',
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-20T23:59:59.999Z',
      sourceKind: 'entries',
      sourceIds: ['e-1'],
      ...overrides,
    });

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([]);
    findUnique = jest.fn().mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        {
          provide: PrismaService,
          useValue: { block: { findMany, findUnique } },
        },
        {
          provide: BlocksService,
          useValue: {
            createInternal: jest.fn().mockResolvedValue({ id: 'new-block' }),
            updateInternal: jest.fn().mockResolvedValue({ id: 'converted' }),
          },
        },
      ],
    }).compile();

    service = module.get(JournalService);
    blocksService = module.get(BlocksService);

    mockParseCompletion
      .mockResolvedValueOnce({ data: { synthesis: 'lo que viví' } })
      .mockResolvedValueOnce({ data: { reflection: 'lo que significó' } });
  });

  afterEach(() => jest.clearAllMocks());

  describe('creating an entry', () => {
    it('stores one text field, mirrored into textOriginal', async () => {
      await service.createEntry({
        text: 'lo que dije',
        source: 'zazu',
        originFormat: 'voice',
        workspaceId: 'ws-1',
      });

      expect(written()).toMatchObject({
        text: 'lo que dije',
        textOriginal: 'lo que dije',
        source: 'zazu',
        originFormat: 'voice',
      });
    });

    it('keeps no trace of how the capture was stored', async () => {
      await service.createEntry({
        text: 'x',
        source: 'zazu',
        originFormat: 'voice',
        workspaceId: 'ws-1',
        sourceId: 'capture-9',
      });

      const props = written();
      // The origin is a reference, not a handle: Journal can say where this came
      // from without knowing what an audio key is.
      expect(props.sourceId).toBe('capture-9');
      expect(props.audioKey).toBeUndefined();
      expect(props.raw).toBeUndefined();
      expect(props.summary).toBeUndefined();
      expect(props.status).toBeUndefined();
    });

    it('refuses an empty entry', async () => {
      await expect(
        service.createEntry({
          text: '   ',
          source: 'app',
          originFormat: 'text',
          workspaceId: 'ws-1',
        }),
      ).rejects.toThrow('text is required');
    });
  });

  describe('converting a capture into an entry', () => {
    it('changes the existing block rather than writing a second one', async () => {
      findUnique.mockResolvedValue({
        id: 'blk-1',
        type: 'capture',
        properties: { text: 'lo capturado', date: '2026-08-20T09:00:00.000Z' },
      });

      await service.convertBlockToEntry('blk-1', { source: 'zazu', originFormat: 'voice' });

      expect(blocksService.createInternal).not.toHaveBeenCalled();
      expect(blocksService.updateInternal).toHaveBeenCalledWith(
        'blk-1',
        expect.objectContaining({ type: 'journal_entry' }),
      );
    });

    it('keeps the date the capture already carried', async () => {
      findUnique.mockResolvedValue({
        id: 'blk-1',
        type: 'capture',
        properties: { text: 'x', date: '2026-08-20T09:00:00.000Z' },
      });

      await service.convertBlockToEntry('blk-1', { source: 'zazu', originFormat: 'voice' });

      const dto = blocksService.updateInternal.mock.calls[0]![1] as any;
      expect(dto.properties.date).toBe('2026-08-20T09:00:00.000Z');
    });
  });

  describe('generating a synthesis', () => {
    it('reads exactly the ids it was given, never a date range', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-20T09:00:00.000Z', 'lo que viví')]);

      await generate({ sourceIds: ['e-1', 'e-2'] });

      const where = findMany.mock.calls[0]![0].where;
      expect(where.id).toEqual({ in: ['e-1', 'e-2'] });
      // The period is a label on the result, not a filter on the query.
      expect(where.properties).toBeUndefined();
      expect(where.createdAt).toBeUndefined();
    });

    it('scopes the read to the workspace even though a service asked', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-20T09:00:00.000Z', 'x')]);

      await generate();

      expect(findMany.mock.calls[0]![0].where).toMatchObject({
        workspaceId: 'ws-1',
        deletedAt: null,
      });
    });

    it('runs two separate calls: the account, then the reading of it', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-20T09:00:00.000Z', 'lo que viví')]);

      await generate();

      expect(mockParseCompletion).toHaveBeenCalledTimes(2);
      const [first, second] = mockParseCompletion.mock.calls.map((c) => c[0].messages[0].content);
      expect(first).toContain('lo que viví');
      // The second call sees the first's output — that is what makes it a
      // reading of the synthesis rather than a second account of the record.
      expect(second).toContain('lo que viví');
      expect(second).toContain('lo que viví');
    });

    it('stores both pieces, each mirrored into its original', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-20T09:00:00.000Z', 'x')]);

      await generate();

      expect(written()).toMatchObject({
        synthesis: 'lo que viví',
        synthesisOriginal: 'lo que viví',
        reflection: 'lo que significó',
        reflectionOriginal: 'lo que significó',
      });
    });

    it('records the period it was asked for, even where the record is thin', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-31T09:00:00.000Z', 'x')]);

      await generate({
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-08-31T23:59:59.999Z',
      });

      // A month whose first three weeks hold nothing is still that whole month.
      expect(written()).toMatchObject({
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-08-31T23:59:59.999Z',
      });
    });

    it('names every source it read, with the span each covered', async () => {
      findMany.mockResolvedValue([
        entry('e-1', '2026-08-20T09:00:00.000Z', 'primera'),
        entry('e-2', '2026-08-20T18:00:00.000Z', 'segunda'),
      ]);

      await generate({ sourceIds: ['e-1', 'e-2'] });

      expect(written().synthesisSource).toEqual({
        kind: 'entries',
        count: 2,
        ids: [
          { id: 'e-1', from: '2026-08-20T09:00:00.000Z', to: '2026-08-20T09:00:00.000Z' },
          { id: 'e-2', from: '2026-08-20T18:00:00.000Z', to: '2026-08-20T18:00:00.000Z' },
        ],
      });
    });

    it('stores the prompts as templates, without the record pasted in', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-20T09:00:00.000Z', 'un secreto')]);

      await generate();

      const { synthesisPrompt, reflectionPrompt } = written().prompts;
      expect(synthesisPrompt).toContain('{{SOURCES: ENTRIES OR SYNTHESES}}');
      expect(reflectionPrompt).toContain('{{SYNTHESIS}}');
      // What filled the placeholder is recoverable through synthesisSource;
      // copying it here would duplicate the person's words into a field kept
      // for auditing instructions.
      expect(synthesisPrompt).not.toContain('un secreto');
      expect(reflectionPrompt).not.toContain('un secreto');
    });
  });

  describe('building on smaller syntheses', () => {
    it('reads their synthesis and never their reflection', async () => {
      findMany.mockResolvedValue([
        synthesis('s-1', '2026-08-01T00:00:00.000Z', '2026-08-07T23:59:59.999Z'),
      ]);

      await generate({ sourceKind: 'syntheses', sourceIds: ['s-1'] });

      const prompts = mockParseCompletion.mock.calls.map((c) => c[0].messages[0].content);
      for (const prompt of prompts) {
        expect(prompt).toContain('la síntesis de s-1');
        // A higher period earns its own reflection from its own vantage point.
        // Inheriting the one below would compound a reading of a reading.
        expect(prompt).not.toContain('la reflexión de s-1');
      }
    });

    it('asks for syntheses, not entries', async () => {
      findMany.mockResolvedValue([
        synthesis('s-1', '2026-08-01T00:00:00.000Z', '2026-08-07T23:59:59.999Z'),
      ]);

      await generate({ sourceKind: 'syntheses', sourceIds: ['s-1'] });

      expect(findMany.mock.calls[0]![0].where.type).toBe('journal_synthesis');
    });

    it('carries each source period through to the provenance', async () => {
      findMany.mockResolvedValue([
        synthesis('s-1', '2026-08-01T00:00:00.000Z', '2026-08-07T23:59:59.999Z'),
      ]);

      await generate({ sourceKind: 'syntheses', sourceIds: ['s-1'] });

      expect(written().synthesisSource.ids).toEqual([
        { id: 's-1', from: '2026-08-01T00:00:00.000Z', to: '2026-08-07T23:59:59.999Z' },
      ]);
    });
  });

  describe('when there is nothing to read', () => {
    it('writes an empty synthesis without calling a model', async () => {
      findMany.mockResolvedValue([]);

      const result = await generate({ sourceIds: [] });

      expect(mockParseCompletion).not.toHaveBeenCalled();
      expect(written()).toMatchObject({ noData: true, synthesis: '', reflection: '' });
      expect(result.success).toBe(true);
    });

    it('says so for a period whose sources are all blank', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-20T09:00:00.000Z', '   ')]);

      await generate();

      expect(mockParseCompletion).not.toHaveBeenCalled();
      expect(written().noData).toBe(true);
    });
  });

  describe('when a model call fails', () => {
    it('retries before giving up', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-20T09:00:00.000Z', 'x')]);
      mockParseCompletion.mockReset();
      mockParseCompletion
        .mockRejectedValueOnce(new Error('502'))
        .mockResolvedValueOnce({ data: { synthesis: 'lo que viví' } })
        .mockResolvedValueOnce({ data: { reflection: 'lo que significó' } });

      await generate();

      expect(written().synthesis).toBe('lo que viví');
    });

    it('fails loudly rather than storing a placeholder as if it were writing', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-20T09:00:00.000Z', 'x')]);
      mockParseCompletion.mockReset();
      mockParseCompletion.mockRejectedValue(new Error('502'));

      // A synthesis reading "not available" is indistinguishable from a real one
      // to every reader downstream. Nothing is written at all.
      await expect(generate()).rejects.toThrow(/Synthesis failed/);
      expect(blocksService.createInternal).not.toHaveBeenCalled();
    });
  });
});
