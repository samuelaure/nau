import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopedPrismaService } from '../../tenancy/scoped-prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Event } from '@prisma/client';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
        {
          provide: ScopedPrismaService,
          useValue: {
            assertBlockAccess: jest.fn().mockResolvedValue({ id: 'b1', workspaceId: 'ws-1' }),
            assertMembership: jest.fn().mockResolvedValue({ userId: 'user-1', workspaceId: 'ws-1' }),
          },
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an event, stamped with the block\'s own workspace', async () => {
    prisma.event.create.mockResolvedValueOnce({
      id: 'e1',
      blockId: 'b1',
      type: 'done',
      metadata: {},
      workspaceId: 'ws-1',
      createdAt: new Date(),
    } as Event);
    await service.create('user-1', 'b1', 'done');
    expect(prisma.event.create).toHaveBeenCalledWith({
      data: { blockId: 'b1', type: 'done', metadata: {}, workspaceId: 'ws-1' },
    });
  });

  it('should find events by block', async () => {
    prisma.event.findMany.mockResolvedValueOnce([]);
    await service.findByBlock('user-1', 'b1');
    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { blockId: 'b1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  // nau#125: the read a tray listing needs — every event of a type prefix
  // across a workspace, with no blockId known in advance.
  describe('findByWorkspaceAndTypePrefix', () => {
    it('finds events by workspace and type prefix, oldest first', async () => {
      prisma.event.findMany.mockResolvedValueOnce([]);
      await service.findByWorkspaceAndTypePrefix('user-1', 'ws-1', 'gtd.');
      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', type: { startsWith: 'gtd.' } },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('asserts membership rather than block access — there is no single block here', async () => {
      const tenancy = { assertMembership: jest.fn().mockResolvedValue({}) };
      const svc = new EventsService(prisma, tenancy as unknown as ScopedPrismaService);
      prisma.event.findMany.mockResolvedValueOnce([]);

      await svc.findByWorkspaceAndTypePrefix('user-1', 'ws-1', 'gtd.');

      expect(tenancy.assertMembership).toHaveBeenCalledWith('user-1', 'ws-1');
    });
  });
});
