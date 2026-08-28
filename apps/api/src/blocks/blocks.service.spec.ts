import { Test, TestingModule } from '@nestjs/testing';
import { BlocksService } from './blocks.service';
import { BlockEventsService } from './block-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Block } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UpdateBlockDto } from './dto/update-block.dto';
import { FindBlocksQueryDto } from './dto/find-blocks-query.dto';
import type { AccessTokenPayload, CreateBlockDto } from '@nau/types';

describe('BlocksService', () => {
  let service: BlocksService;
  let prisma: DeepMockProxy<PrismaService>;

  const user = {
    sub: 'user-1',
    workspaceId: 'ws-1',
    role: 'OWNER',
    iat: 0,
    exp: 0,
  } as AccessTokenPayload;

  const mockBlock: Block = {
    id: 'block-1',
    type: 'note',
    properties: { text: 'Test note' } as Prisma.JsonObject,
    parentId: null,
    uuid: 'uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    source: null,
    sourceRef: null,
    workspaceId: 'ws-1',
    userId: null,
  };

  /** Makes user-1 a member of ws-1 and nothing else. */
  const asMemberOfWs1 = () => {
    prisma.workspaceMember.findUnique.mockImplementation((args: any) =>
      args.where.userId_workspaceId.workspaceId === 'ws-1'
        ? ({ userId: 'user-1', workspaceId: 'ws-1', role: 'OWNER' } as any)
        : (null as any),
    );
    prisma.workspaceMember.findMany.mockResolvedValue([
      { workspaceId: 'ws-1' },
    ] as any);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlocksService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
        {
          // The activity log is written alongside every mutation. It is
          // best-effort by design, so these tests assert the mutation and leave
          // the log's own behaviour to block-events.service.spec.
          provide: BlockEventsService,
          useValue: { record: jest.fn(), recordUpdate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BlocksService>(BlocksService);
    prisma = module.get(PrismaService);
    asMemberOfWs1();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInternal', () => {
    const createBlockDto: CreateBlockDto = {
      type: 'note',
      properties: { text: 'New note' },
    };

    it('should create a block with a default sortOrder if no siblings exist', async () => {
      prisma.block.findMany.mockResolvedValueOnce([]);
      prisma.block.create.mockResolvedValueOnce({
        ...mockBlock,
        properties: { text: 'New note', sortOrder: 1 } as Prisma.JsonObject,
      });

      const result = await service.createInternal(createBlockDto);

      expect(prisma.block.create).toHaveBeenCalledWith({
        data: {
          type: 'note',
          properties: { text: 'New note', sortOrder: 1 },
          userId: null,
        },
      });
      expect(result.properties).toEqual({ text: 'New note', sortOrder: 1 });
    });

    it('should create a block with an incremented sortOrder based on last sibling', async () => {
      const existingBlocks: Block[] = [
        {
          ...mockBlock,
          id: 'b1',
          properties: { sortOrder: 5 } as Prisma.JsonObject,
        },
        {
          ...mockBlock,
          id: 'b2',
          properties: { sortOrder: 3 } as Prisma.JsonObject,
        },
      ];
      prisma.block.findMany.mockResolvedValueOnce(existingBlocks);
      prisma.block.create.mockResolvedValueOnce({
        ...mockBlock,
        properties: { text: 'New note', sortOrder: 6 } as Prisma.JsonObject,
      });

      const result = await service.createInternal(createBlockDto);

      expect(prisma.block.create).toHaveBeenCalledWith({
        data: {
          type: 'note',
          properties: { text: 'New note', sortOrder: 6 },
          userId: null,
        },
      });
      expect(result.properties).toEqual({ text: 'New note', sortOrder: 6 });
    });
  });

  describe('create', () => {
    it('should stamp the caller as owner and scope to their workspace', async () => {
      prisma.block.findMany.mockResolvedValueOnce([]);
      prisma.block.create.mockResolvedValueOnce(mockBlock);

      await service.create(user, { type: 'note', properties: { text: 'hi' } });

      expect(prisma.block.create).toHaveBeenCalledWith({
        data: {
          type: 'note',
          properties: { text: 'hi', sortOrder: 1 },
          workspace: { connect: { id: 'ws-1' } },
          userId: 'user-1',
        },
      });
    });

    it('should compute sortOrder among siblings of the same workspace only', async () => {
      prisma.block.findMany.mockResolvedValueOnce([]);
      prisma.block.create.mockResolvedValueOnce(mockBlock);

      await service.create(user, { type: 'note', properties: {} });

      expect(prisma.block.findMany).toHaveBeenCalledWith({
        where: { parentId: null, type: 'note', workspaceId: 'ws-1' },
      });
    });

    it('should reject a workspace the caller does not belong to', async () => {
      await expect(
        service.create(user, {
          type: 'note',
          properties: {},
          workspaceId: 'ws-other',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.block.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllInternal', () => {
    it('should return all blocks filtered by type and excluding trash status', async () => {
      prisma.block.findMany.mockResolvedValueOnce([
        {
          ...mockBlock,
          id: 'b1',
          type: 'action',
          properties: { status: 'inbox' } as Prisma.JsonObject,
        },
      ]);

      const query: FindBlocksQueryDto = { type: 'action' };
      const result = await service.findAllInternal(query);

      expect(prisma.block.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          type: 'action',
          properties: { path: ['status'], not: 'trash' },
        },
      });
      expect(result.map((b) => b.id)).toEqual(['b1']);
    });

    it('should filter by specific status', async () => {
      prisma.block.findMany.mockResolvedValueOnce([
        {
          ...mockBlock,
          id: 'b3',
          type: 'action',
          properties: { status: 'completed' } as Prisma.JsonObject,
        },
      ]);

      const result = await service.findAllInternal({ status: 'completed' });

      expect(prisma.block.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          properties: { path: ['status'], equals: 'completed' },
        },
      });
      expect(result.map((b) => b.id)).toEqual(['b3']);
    });
  });

  describe('findAll', () => {
    it('should restrict results to the workspaces the caller belongs to', async () => {
      prisma.block.findMany.mockResolvedValueOnce([mockBlock]);

      await service.findAll(user.sub, { type: 'action' });

      expect(prisma.block.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          workspaceId: { in: ['ws-1'] },
          type: 'action',
          AND: [{ properties: { path: ['status'], not: 'trash' } }],
        },
        // When something is due lives in its own table, so it has to travel
        // with the block. A view that cannot see it has to guess, which is how
        // properties.date came to mean two different things in two screens.
        include: { schedule: { include: { exceptions: true } } },
      });
    });

    it('should filter by date range on the server', async () => {
      prisma.block.findMany.mockResolvedValueOnce([]);

      await service.findAll(user.sub, {
        types: 'journal_entry,journal_synthesis',
        from: '2026-08-01',
        to: '2026-08-31',
      });

      const arg = prisma.block.findMany.mock.calls[0]![0] as any;
      expect(arg.where.type).toEqual({ in: ['journal_entry', 'journal_synthesis'] });
      expect(arg.where.AND).toEqual([
        { properties: { path: ['status'], not: 'trash' } },
        {
          OR: [
            { properties: { path: ['date'], gte: '2026-08-01', lte: '2026-08-31' } },
            {
              AND: [
                { properties: { path: ['to'], gte: '2026-08-01' } },
                { properties: { path: ['from'], lte: '2026-08-31' } },
              ],
            },
          ],
        },
      ]);
    });

    /**
     * The exact regression: a journal_synthesis carries no `date` at all — it
     * covers a span, stored as `from`/`to`. Filtering only on `date` is an AND
     * against a key that never exists on that type, so it matches zero rows.
     * Every synthesis ever generated was invisible to any range-scoped query —
     * including the journal view's own request — while appearing correctly in
     * an unscoped query.
     */
    it('includes a journal_synthesis whose period overlaps the requested range, even with no `date` property', async () => {
      const summaryBlock = {
        ...mockBlock,
        type: 'journal_synthesis',
        properties: {
          from: '2026-08-24T22:00:00.000Z',
          to: '2026-08-25T21:59:59.999Z',
          synthesis: 'lo que pasó el 25',
          reflection: 'lo que significó',
          // Deliberately no `date` key — this is the real shape a synthesis has.
        },
      };
      prisma.block.findMany.mockResolvedValueOnce([summaryBlock]);

      const result = await service.findAll(user.sub, {
        types: 'journal_synthesis',
        from: '2026-08-25T00:00:00.000Z',
        to: '2026-08-25T23:59:59.999Z',
      });

      // The where-clause construction is asserted above; this asserts the
      // actual failure mode — a synthesis the person just received not showing
      // up in the exact view built to display it.
      expect(result).toEqual([summaryBlock]);
    });

    it('should reject an explicit workspace the caller does not belong to', async () => {
      await expect(
        service.findAll(user.sub, { workspaceId: 'ws-other' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.block.findMany).not.toHaveBeenCalled();
    });

    it('should return nothing for a user with no memberships', async () => {
      prisma.workspaceMember.findMany.mockResolvedValueOnce([] as any);

      const result = await service.findAll('stranger', {});

      expect(result).toEqual([]);
      expect(prisma.block.findMany).not.toHaveBeenCalled();
    });

    it('should sort blocks correctly when dates are present', async () => {
      prisma.block.findMany.mockResolvedValueOnce([
        {
          ...mockBlock,
          id: 'b1',
          properties: { date: '2025-08-05' } as Prisma.JsonObject,
        },
        {
          ...mockBlock,
          id: 'b2',
          properties: { date: '2025-08-07' } as Prisma.JsonObject,
        },
        {
          ...mockBlock,
          id: 'b3',
          properties: { date: '2025-08-06' } as Prisma.JsonObject,
        },
      ]);

      const result = await service.findAll(user.sub, {});
      expect(result.map((b) => b.id)).toEqual(['b2', 'b3', 'b1']);
    });
  });

  describe('assertBlockAccess', () => {
    it('should reject a block belonging to another workspace', async () => {
      prisma.block.findUnique.mockResolvedValueOnce({
        ...mockBlock,
        workspaceId: 'ws-other',
      });

      await expect(
        service.assertBlockAccess(user.sub, 'block-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject an orphan block with no workspace', async () => {
      prisma.block.findUnique.mockResolvedValueOnce({
        ...mockBlock,
        workspaceId: null,
      });

      await expect(
        service.assertBlockAccess(user.sub, 'block-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for a soft deleted block', async () => {
      prisma.block.findUnique.mockResolvedValueOnce({
        ...mockBlock,
        deletedAt: new Date(),
      });

      await expect(
        service.assertBlockAccess(user.sub, 'block-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateBlockDto: UpdateBlockDto = {
      properties: { text: 'Updated note' },
    };

    it('should update a block successfully', async () => {
      prisma.block.findUnique.mockResolvedValueOnce(mockBlock);
      prisma.block.update.mockResolvedValueOnce({
        ...mockBlock,
        properties: { text: 'Updated note' } as Prisma.JsonObject,
      });

      const result = await service.update(user.sub, 'block-1', updateBlockDto);

      expect(prisma.block.update).toHaveBeenCalledWith({
        where: { id: 'block-1' },
        data: { properties: { text: 'Updated note' } },
      });
      expect(result.properties).toEqual({ text: 'Updated note' });
    });

    it('should throw NotFoundException if block does not exist', async () => {
      prisma.block.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.update(user.sub, 'non-existent-id', updateBlockDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update a block type', async () => {
      prisma.block.findUnique.mockResolvedValueOnce(mockBlock);
      prisma.block.update.mockResolvedValueOnce({
        ...mockBlock,
        type: 'action',
      });

      const result = await service.update(user.sub, 'block-1', {
        type: 'action',
      });

      expect(prisma.block.update).toHaveBeenCalledWith({
        where: { id: 'block-1' },
        data: { type: 'action' },
      });
      expect(result.type).toBe('action');
    });
  });

  describe('remove', () => {
    it('should soft delete a block successfully', async () => {
      prisma.block.findUnique.mockResolvedValueOnce(mockBlock);
      prisma.block.update.mockResolvedValueOnce(mockBlock);

      const result = await service.remove(user.sub, 'block-1');

      expect(prisma.block.update).toHaveBeenCalledWith({
        where: { id: 'block-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.id).toBe('block-1');
    });

    it('should throw NotFoundException if block does not exist', async () => {
      prisma.block.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.remove(user.sub, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should find a block by id', async () => {
      prisma.block.findUnique.mockResolvedValueOnce(mockBlock);
      prisma.block.findUnique.mockResolvedValueOnce(mockBlock);

      const result = await service.findOne(user.sub, 'block-1');

      expect(prisma.block.findUnique).toHaveBeenLastCalledWith({
        where: { id: 'block-1' },
        include: {
          children: true,
          relationsFrom: true,
          relationsTo: true,
          schedule: true,
        },
      });
      expect(result!.id).toBe('block-1');
    });

    it('should throw NotFoundException if block is soft deleted', async () => {
      prisma.block.findUnique.mockResolvedValueOnce({
        ...mockBlock,
        deletedAt: new Date(),
      });
      await expect(service.findOne(user.sub, 'block-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRemindableBlocks', () => {
    it('should return blocks with schedules scoped to the caller', async () => {
      prisma.block.findMany.mockResolvedValueOnce([mockBlock]);

      const result = await service.getRemindableBlocks(user.sub);

      expect(prisma.block.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          workspaceId: { in: ['ws-1'] },
          schedule: { isNot: null },
        },
        include: { schedule: true },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('addTag', () => {
    it('should reject a tag from a different workspace', async () => {
      prisma.block.findUnique.mockResolvedValueOnce(mockBlock);
      prisma.tag.findUnique.mockResolvedValueOnce({
        id: 'tag-1',
        workspaceId: 'ws-other',
      } as any);

      await expect(
        service.addTag(user.sub, 'block-1', 'tag-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.blockTag.create).not.toHaveBeenCalled();
    });

    it('should link a tag from the same workspace', async () => {
      prisma.block.findUnique.mockResolvedValueOnce(mockBlock);
      prisma.tag.findUnique.mockResolvedValueOnce({
        id: 'tag-1',
        workspaceId: 'ws-1',
      } as any);
      prisma.blockTag.create.mockResolvedValueOnce({} as any);

      await service.addTag(user.sub, 'block-1', 'tag-1');

      expect(prisma.blockTag.create).toHaveBeenCalledWith({
        data: { blockId: 'block-1', tagId: 'tag-1' },
      });
    });
  });
});
