import { JournalService } from './journal.service';
import type { ScopedPrismaService } from '../../core/tenancy/scoped-prisma.service';

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
  let findMany: jest.Mock;
  let findUnique: jest.Mock;
  let create: jest.Mock;
  let update: jest.Mock;
  let forWorkspace: jest.Mock;
  let unscopedFindUnique: jest.Mock;

  /** The `data` of the last `client.block.create` call. */
  const written = () => create.mock.calls[0]![0].data.properties as Record<string, any>;

  const generate = (overrides: Partial<Parameters<JournalService['generateSynthesis']>[0]> = {}) =>
    service.generateSynthesis({
      workspaceId: 'ws-1',
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-20T23:59:59.999Z',
      sourceKind: 'entries',
      sourceIds: ['e-1'],
      ...overrides,
    });

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    findUnique = jest.fn().mockResolvedValue(null);
    create = jest.fn().mockResolvedValue({ id: 'new-block' });
    update = jest.fn().mockResolvedValue({ id: 'converted' });
    unscopedFindUnique = jest.fn().mockResolvedValue(null);

    const scopedClient = { block: { findMany, findUnique, create, update } };
    forWorkspace = jest.fn().mockReturnValue(scopedClient);

    const scoped = {
      forWorkspace,
      unscoped: () => ({ block: { findUnique: unscopedFindUnique } }),
    } as unknown as ScopedPrismaService;

    service = new JournalService(scoped);

    mockParseCompletion.mockReset();
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

      expect(forWorkspace).toHaveBeenCalledWith('ws-1');
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

    it('writes under the pre-migration type string, not the kind id', async () => {
      // The kind id (journal.entry) is the contract; the column keeps today's
      // value until the vocabulary migration (nau#68) runs.
      await service.createEntry({
        text: 'x',
        source: 'app',
        originFormat: 'text',
        workspaceId: 'ws-1',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'journal_entry' }) }),
      );
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
      unscopedFindUnique.mockResolvedValue({
        id: 'blk-1',
        type: 'capture',
        workspaceId: 'ws-1',
        deletedAt: null,
        properties: { text: 'lo capturado', date: '2026-08-20T09:00:00.000Z' },
      });

      await service.convertBlockToEntry('blk-1', { source: 'zazu', originFormat: 'voice' });

      expect(create).not.toHaveBeenCalled();
      expect(forWorkspace).toHaveBeenCalledWith('ws-1');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'blk-1' },
          data: expect.objectContaining({ type: 'journal_entry' }),
        }),
      );
    });

    it('keeps the date the capture already carried', async () => {
      unscopedFindUnique.mockResolvedValue({
        id: 'blk-1',
        type: 'capture',
        workspaceId: 'ws-1',
        deletedAt: null,
        properties: { text: 'x', date: '2026-08-20T09:00:00.000Z' },
      });

      await service.convertBlockToEntry('blk-1', { source: 'zazu', originFormat: 'voice' });

      const dto = update.mock.calls[0]![0] as any;
      expect(dto.data.properties.date).toBe('2026-08-20T09:00:00.000Z');
    });

    it('refuses a block that does not exist', async () => {
      unscopedFindUnique.mockResolvedValue(null);

      await expect(
        service.convertBlockToEntry('missing', { source: 'zazu', originFormat: 'voice' }),
      ).rejects.toThrow('missing');
      expect(update).not.toHaveBeenCalled();
    });

    it('refuses a soft-deleted block', async () => {
      unscopedFindUnique.mockResolvedValue({
        id: 'blk-1',
        workspaceId: 'ws-1',
        deletedAt: new Date(),
        properties: { text: 'x' },
      });

      await expect(
        service.convertBlockToEntry('blk-1', { source: 'zazu', originFormat: 'voice' }),
      ).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
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
      // No workspaceId in the where clause either — that filter is applied by
      // the scoped client itself, not written by this service.
      expect(where.workspaceId).toBeUndefined();
    });

    it('scopes every read and write to the workspace it was asked about', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-20T09:00:00.000Z', 'x')]);

      await generate();

      expect(forWorkspace).toHaveBeenCalledWith('ws-1');
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

    it('writes under the pre-migration type string', async () => {
      findMany.mockResolvedValue([entry('e-1', '2026-08-20T09:00:00.000Z', 'x')]);

      await generate();

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'journal_synthesis' }) }),
      );
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
      expect(create).not.toHaveBeenCalled();
    });
  });

  // The typed contract Time consumes instead of reading `properties` directly
  // (nau#63). A key renamed here must fail these tests before it can break
  // Time silently at runtime.
  describe('entriesIn — the typed contract Time consumes', () => {
    const range = { start: new Date('2026-08-17T00:00:00Z'), end: new Date('2026-08-18T00:00:00Z') };

    it('returns entries lived inside the range, by the date they were lived', async () => {
      findMany.mockResolvedValue([
        entry('e1', '2026-08-17T09:00:00Z', 'texto uno'),
        entry('e2', '2026-08-17T22:00:00Z', 'texto largo con mas contenido'),
      ]);

      const rows = await service.entriesIn('ws-1', range);

      expect(forWorkspace).toHaveBeenCalledWith('ws-1');
      expect(rows.map((r) => r.id)).toEqual(['e1', 'e2']);
      expect(rows[0]!.at).toEqual(new Date('2026-08-17T09:00:00Z'));
      expect(rows[1]!.textLength).toBe('texto largo con mas contenido'.length);
    });

    it('excludes an entry whose lived date falls outside the range', async () => {
      findMany.mockResolvedValue([entry('e1', '2026-08-16T23:00:00Z', 'texto')]);

      const rows = await service.entriesIn('ws-1', range);

      expect(rows).toHaveLength(0);
    });

    it('orders by when the entry was lived, not by creation order', async () => {
      findMany.mockResolvedValue([
        entry('later', '2026-08-17T20:00:00Z', 'segundo'),
        entry('earlier', '2026-08-17T06:00:00Z', 'primero'),
      ]);

      const rows = await service.entriesIn('ws-1', range);

      expect(rows.map((r) => r.id)).toEqual(['earlier', 'later']);
    });
  });

  describe('synthesesStartingIn — the typed contract Time consumes', () => {
    const range = { start: new Date('2026-08-01T00:00:00Z'), end: new Date('2026-09-01T00:00:00Z') };

    it('returns a synthesis whose period starts inside the range', async () => {
      findMany.mockResolvedValue([synthesis('s1', '2026-08-10T00:00:00Z', '2026-08-17T00:00:00Z')]);

      const rows = await service.synthesesStartingIn('ws-1', range);

      expect(rows[0]!.id).toBe('s1');
      expect(rows[0]!.at).toEqual(new Date('2026-08-10T00:00:00Z'));
    });

    it('excludes a noData placeholder — it holds nothing to compose from', async () => {
      const empty = synthesis('s1', '2026-08-10T00:00:00Z', '2026-08-17T00:00:00Z');
      (empty.properties as any).noData = true;
      findMany.mockResolvedValue([empty]);

      const rows = await service.synthesesStartingIn('ws-1', range);

      expect(rows).toHaveLength(0);
    });

    it('excludes a synthesis whose period starts outside the range', async () => {
      findMany.mockResolvedValue([synthesis('s1', '2026-09-05T00:00:00Z', '2026-09-12T00:00:00Z')]);

      const rows = await service.synthesesStartingIn('ws-1', range);

      expect(rows).toHaveLength(0);
    });
  });
});
