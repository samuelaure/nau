import { Test, TestingModule } from '@nestjs/testing';
import { RelationsService } from './relations.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Relation } from '@prisma/client';

describe('RelationsService', () => {
  let service: RelationsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationsService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
        {
          provide: BlocksService,
          useValue: { assertBlockAccess: jest.fn().mockResolvedValue({ id: 'b1', workspaceId: 'ws-1' }) },
        },
      ],
    }).compile();

    service = module.get<RelationsService>(RelationsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a relation', async () => {
    const mockRelation = {
      id: 'rel-1',
      fromBlockId: 'b1',
      toBlockId: 'b2',
      type: 'link',
      properties: {},
      createdAt: new Date(),
    };
    prisma.relation.create.mockResolvedValueOnce(mockRelation as Relation);

    const result = await service.create('user-1', 'b1', 'b2', 'link');

    expect(prisma.relation.create).toHaveBeenCalledWith({
      data: {
        fromBlockId: 'b1',
        toBlockId: 'b2',
        type: 'link',
        properties: {},
      },
    });
    expect(result.id).toBe('rel-1');
  });

  it('should remove a relation', async () => {
    prisma.relation.findUnique.mockResolvedValueOnce({
      id: 'rel-1',
      fromBlockId: 'b1',
    } as unknown as Relation);
    prisma.relation.delete.mockResolvedValueOnce({
      id: 'rel-1',
    } as unknown as Relation);
    await service.remove('user-1', 'rel-1');
    expect(prisma.relation.delete).toHaveBeenCalledWith({
      where: { id: 'rel-1' },
    });
  });
});
