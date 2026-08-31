import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TriageService } from './triage.service';
import { BlocksService } from '../blocks/blocks.service';
import { NauthenticityService } from '../integrations/nauthenticity.service';
import { FlownauIntegrationService } from '../integrations/flownau.service';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from '../relations/journal/journal.service';
import { Prisma } from '@prisma/client';

// Minimal inline type to avoid a hard dependency on generated @prisma/client
interface MockBlock {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  parentId: string | null;
  uuid: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  source: string | null;
  sourceRef: string | null;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock Prisma client so the generated binary is not required in the test environment
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeBlock = (overrides: Partial<MockBlock> = {}): MockBlock => ({
  id: 'block-1',
  type: 'content_idea',
  properties: {} as Prisma.JsonObject,
  parentId: null,
  uuid: 'uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  source: null,
  sourceRef: null,
  ...overrides,
});

const contentIdeaTriageResult = {
  segments: [
    {
      category: 'content_idea',
      reasoning: 'User mentioned content idea for brand',
      text: 'Create a reel about productivity hacks',
      metadata: { brandId: 'brand-abc', brandName: 'TestBrand' },
    },
  ],
};

const actionTriageResult = {
  segments: [
    {
      category: 'action',
      reasoning: 'Concrete task identified',
      text: 'Send the report by Friday',
      metadata: { priority: 'high', deadline: '2026-04-25' },
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TriageService', () => {
  let service: TriageService;
  let blocksService: jest.Mocked<BlocksService>;
  let journalService: jest.Mocked<JournalService>;
  let nauthenticityService: jest.Mocked<NauthenticityService>;
  let flownauService: jest.Mocked<FlownauIntegrationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') return 'test-openai-key';
              return undefined;
            }),
          },
        },
        {
          provide: BlocksService,
          useValue: {
            createInternal: jest.fn(),
            updateInternal: jest.fn(),
            findAllInternal: jest.fn(),
          },
        },
        {
          provide: NauthenticityService,
          useValue: {
            getBrandsForWorkspace: jest.fn(),
            getBrandDnaLight: jest.fn(),
          },
        },
        {
          provide: FlownauIntegrationService,
          useValue: {
            ingestIdeas: jest.fn(),
            resolveAccountByBrandId: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: { findFirst: jest.fn() },
          },
        },
        {
          provide: JournalService,
          useValue: {
            createEntry: jest.fn().mockResolvedValue({ id: 'journal-block' }),
          },
        },
      ],
    }).compile();

    service = module.get<TriageService>(TriageService);
    blocksService = module.get(BlocksService);
    journalService = module.get(JournalService);
    nauthenticityService = module.get(NauthenticityService);
    flownauService = module.get(FlownauIntegrationService);

    // Default mocks
    nauthenticityService.getBrandsForWorkspace.mockResolvedValue([]);
    flownauService.resolveAccountByBrandId.mockResolvedValue('acc-123');
    blocksService.findAllInternal.mockResolvedValue([]);
    blocksService.createInternal.mockResolvedValue(makeBlock() as any);
    blocksService.updateInternal.mockResolvedValue(makeBlock() as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── processRawText / saveTriagedBlocks ──────────────────────────────────

  describe('processRawText', () => {
    beforeEach(() => {
      mockParseCompletion.mockClear();
    });

    it('calls FlownauIntegrationService.ingestIdeas when a content_idea with a brandId is triaged', async () => {
      mockParseCompletion.mockResolvedValueOnce({ data: contentIdeaTriageResult });
      blocksService.createInternal.mockResolvedValueOnce(makeBlock({ id: 'idea-block-1' }) as any);

      await service.processRawText('Create a reel about productivity hacks', 'user-123');

      expect(flownauService.ingestIdeas).toHaveBeenCalledTimes(1);
      expect(flownauService.ingestIdeas).toHaveBeenCalledWith('acc-123', [
        { text: 'Create a reel about productivity hacks', sourceRef: 'idea-block-1', aiLinked: false },
      ]);
    });

    it('marks the block as flownauSyncStatus: "success" after a successful ingest', async () => {
      mockParseCompletion.mockResolvedValueOnce({ data: contentIdeaTriageResult });
      const ideaBlock = makeBlock({ id: 'idea-block-2' });
      blocksService.createInternal.mockResolvedValueOnce(ideaBlock as any);
      flownauService.ingestIdeas.mockResolvedValueOnce(undefined);

      await service.processRawText('some text', 'user-123');

      expect(blocksService.updateInternal).toHaveBeenCalledWith(
        'idea-block-2',
        { properties: { flownauSyncStatus: 'success' } },
      );
    });

    it('marks the block as flownauSyncStatus: "error" and does NOT throw when Flownau is unreachable', async () => {
      mockParseCompletion.mockResolvedValueOnce({ data: contentIdeaTriageResult });
      const ideaBlock = makeBlock({ id: 'idea-block-3' });
      blocksService.createInternal.mockResolvedValueOnce(ideaBlock as any);
      flownauService.ingestIdeas.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      // Should NOT throw — fault-tolerance requirement
      await expect(
        service.processRawText('some text', 'user-123'),
      ).resolves.not.toThrow();

      expect(blocksService.updateInternal).toHaveBeenCalledWith(
        'idea-block-3',
        { properties: { flownauSyncStatus: 'error' } },
      );
    });

    it('does NOT call FlownauIntegrationService for non-content_idea segments', async () => {
      mockParseCompletion.mockResolvedValueOnce({ data: actionTriageResult });
      blocksService.createInternal.mockResolvedValue(makeBlock({ type: 'action' }) as any);

      await service.processRawText('Send the report by Friday', 'user-123');

      expect(flownauService.ingestIdeas).not.toHaveBeenCalled();
    });

    it('does NOT call FlownauIntegrationService for content_idea blocks without a brandId', async () => {
      const noBrandResult = {
        segments: [
          {
            category: 'content_idea',
            reasoning: 'Generic content idea, no brand identified',
            text: 'Generic content idea',
            metadata: {},
          },
        ],
      };
      mockParseCompletion.mockResolvedValueOnce({ data: noBrandResult });
      blocksService.createInternal.mockResolvedValue(makeBlock() as any);

      await service.processRawText('generic idea', 'user-123');

      expect(flownauService.ingestIdeas).not.toHaveBeenCalled();
    });

    it('writes no journal entry: the triage path was not asked for one', async () => {
      // It used to write one from a model-generated "journalSummary", which put
      // a third-person recap of the user's tasks into their diary.
      mockParseCompletion.mockResolvedValueOnce({ data: actionTriageResult });

      await service.processRawText('send the report by friday', 'user-123');

      const types = blocksService.createInternal.mock.calls.map((c) => c[0]!.type);
      expect(types).not.toContain('journal_entry');
    });

    it('sets flownauSyncStatus: "pending" in block properties before calling Flownau', async () => {
      mockParseCompletion.mockResolvedValueOnce({ data: contentIdeaTriageResult });
      blocksService.createInternal.mockResolvedValueOnce(makeBlock({ id: 'idea-block-4' }) as any);

      await service.processRawText('some idea', 'user-123');

      const createCall = blocksService.createInternal.mock.calls[0]![0];
      expect((createCall.properties as Record<string, unknown>).flownauSyncStatus).toBe('pending');
    });
  });

  // ─── journal-only path ────────────────────────────────────────────────────

  describe('processRawText (journalOnly)', () => {
    beforeEach(() => {
      const prisma = (service as unknown as { prisma: { user: { findFirst: jest.Mock } } }).prisma;
      prisma.user.findFirst.mockResolvedValue({ id: 'user-123', workspaces: [] });
    });

    it('stores the text exactly as received, without a further model rewrite', async () => {
      const spoken = 'Hoy fui al taller y por fin arreglaron la bici.';

      await service.processRawText(spoken, 'user-123', 'vn-1', null, 'ws-1', true);

      // Zazu already transcribed and cleaned this once. A second pass here made
      // three rewrites stand between what was said and what the diary records.
      expect(mockParseCompletion).not.toHaveBeenCalled();
      expect(journalService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({ text: spoken }),
      );
    });

    /**
     * Triage decides that something is a diary entry. What an entry *is* — its
     * fields, its defaults — belongs to Journal. This path assembling the block
     * itself is what let it drift from the web capture path until the two wrote
     * different shapes for the same thing.
     */
    it('hands the entry to Journal rather than writing the block itself', async () => {
      await service.processRawText('Hoy fui al taller.', 'user-123', 'vn-1', null, 'ws-1', true);

      expect(journalService.createEntry).toHaveBeenCalledTimes(1);
      expect(blocksService.createInternal).not.toHaveBeenCalled();
    });

    it('records where the capture came from, without carrying its format inward', async () => {
      await service.processRawText('Hoy fui al taller.', 'user-123', 'vn-1', null, 'ws-1', true);

      expect(journalService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'zazu',
          originFormat: 'voice',
          // The capture stays reachable, as a reference — never as an audio
          // handle Journal would have to understand.
          sourceId: 'vn-1',
        }),
      );
    });

    it('dates the entry when it was captured, not when it was processed', async () => {
      const capturedAt = '2026-08-21T23:50:00.000Z';

      await service.processRawText('tarde', 'user-123', 'vn-1', null, 'ws-1', true, capturedAt);

      expect(journalService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({ date: capturedAt }),
      );
    });

    /**
     * Zazŭ still sends `rawText` — it did so before an entry held one text
     * field, and it deploys separately from this service. Accepting and
     * ignoring the field is what lets the two ship independently; rejecting it
     * would break every voice note between the two deploys.
     */
    it('tolerates a caller still sending the old rawText field', async () => {
      await expect(
        (service.processRawText as unknown as (...args: unknown[]) => Promise<unknown>)(
          'Hoy fui al taller.',
          'user-123',
          'vn-1',
          null,
          'ws-1',
          true,
          undefined,
          'eh hoy fui al al taller o sea',
        ),
      ).resolves.toBeDefined();

      expect(journalService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Hoy fui al taller.' }),
      );
    });

    /**
     * An entry with no workspace is written, counted, and visible in no view the
     * person can reach. Refusing is the honest failure: the bot reports it
     * instead of confirming a save that silently went nowhere.
     */
    it('refuses to file an entry it cannot attach to a workspace', async () => {
      const prisma = (service as unknown as { prisma: { user: { findFirst: jest.Mock } } }).prisma;
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.processRawText('sin casa', 'user-123', 'vn-1', null, undefined, true),
      ).rejects.toThrow(/workspace/i);

      expect(journalService.createEntry).not.toHaveBeenCalled();
    });
  });
});
