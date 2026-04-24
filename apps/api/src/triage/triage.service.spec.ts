import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TriageService } from './triage.service';
import { BlocksService } from '../blocks/blocks.service';
import { NauthenticityService } from '../integrations/nauthenticity.service';
import { FlownauIntegrationService } from '../integrations/flownau.service';
import { PrismaService } from '../prisma/prisma.service';
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
  journalSummary: 'User captured a content idea.',
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
  journalSummary: 'User has a task to complete.',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TriageService', () => {
  let service: TriageService;
  let blocksService: jest.Mocked<BlocksService>;
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
            create: jest.fn(),
            update: jest.fn(),
            findAll: jest.fn(),
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
      ],
    }).compile();

    service = module.get<TriageService>(TriageService);
    blocksService = module.get(BlocksService);
    nauthenticityService = module.get(NauthenticityService);
    flownauService = module.get(FlownauIntegrationService);

    // Default mocks
    nauthenticityService.getBrandsForWorkspace.mockResolvedValue([]);
    flownauService.resolveAccountByBrandId.mockResolvedValue('acc-123');
    blocksService.findAll.mockResolvedValue([]);
    blocksService.create.mockResolvedValue(makeBlock() as any);
    blocksService.update.mockResolvedValue(makeBlock() as any);
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
      blocksService.create.mockResolvedValueOnce(makeBlock({ id: 'idea-block-1' }) as any);

      await service.processRawText('Create a reel about productivity hacks', 'user-123');

      expect(flownauService.ingestIdeas).toHaveBeenCalledTimes(1);
      expect(flownauService.ingestIdeas).toHaveBeenCalledWith('acc-123', [
        { text: 'Create a reel about productivity hacks', sourceRef: 'idea-block-1', aiLinked: false },
      ]);
    });

    it('marks the block as flownauSyncStatus: "success" after a successful ingest', async () => {
      mockParseCompletion.mockResolvedValueOnce({ data: contentIdeaTriageResult });
      const ideaBlock = makeBlock({ id: 'idea-block-2' });
      blocksService.create.mockResolvedValueOnce(ideaBlock as any);
      flownauService.ingestIdeas.mockResolvedValueOnce(undefined);

      await service.processRawText('some text', 'user-123');

      expect(blocksService.update).toHaveBeenCalledWith(
        'idea-block-2',
        { properties: { flownauSyncStatus: 'success' } },
      );
    });

    it('marks the block as flownauSyncStatus: "error" and does NOT throw when Flownau is unreachable', async () => {
      mockParseCompletion.mockResolvedValueOnce({ data: contentIdeaTriageResult });
      const ideaBlock = makeBlock({ id: 'idea-block-3' });
      blocksService.create.mockResolvedValueOnce(ideaBlock as any);
      flownauService.ingestIdeas.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      // Should NOT throw — fault-tolerance requirement
      await expect(
        service.processRawText('some text', 'user-123'),
      ).resolves.not.toThrow();

      expect(blocksService.update).toHaveBeenCalledWith(
        'idea-block-3',
        { properties: { flownauSyncStatus: 'error' } },
      );
    });

    it('does NOT call FlownauIntegrationService for non-content_idea segments', async () => {
      mockParseCompletion.mockResolvedValueOnce({ data: actionTriageResult });
      blocksService.create.mockResolvedValue(makeBlock({ type: 'action' }) as any);

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
        journalSummary: 'Generic idea captured.',
      };
      mockParseCompletion.mockResolvedValueOnce({ data: noBrandResult });
      blocksService.create.mockResolvedValue(makeBlock() as any);

      await service.processRawText('generic idea', 'user-123');

      expect(flownauService.ingestIdeas).not.toHaveBeenCalled();
    });

    it('sets flownauSyncStatus: "pending" in block properties before calling Flownau', async () => {
      mockParseCompletion.mockResolvedValueOnce({ data: contentIdeaTriageResult });
      blocksService.create.mockResolvedValueOnce(makeBlock({ id: 'idea-block-4' }) as any);

      await service.processRawText('some idea', 'user-123');

      const createCall = blocksService.create.mock.calls[0]![0];
      expect((createCall.properties as Record<string, unknown>).flownauSyncStatus).toBe('pending');
    });
  });
});
