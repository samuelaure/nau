import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleService } from './schedule.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { BlockEventsService } from '../blocks/block-events.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Schedule } from '@prisma/client';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let prisma: DeepMockProxy<PrismaService>;
  let events: jest.Mocked<BlockEventsService>;

  const MONDAY = new Date('2026-08-17T08:00:00.000Z');
  const TUESDAY = new Date('2026-08-18T08:00:00.000Z');

  const existing = (over: Partial<Schedule> = {}) =>
    ({
      id: 'sch-1',
      blockId: 'b1',
      startDate: MONDAY,
      endDate: null,
      rrule: null,
      timezone: null,
      recurrenceMode: 'FIXED',
      completedAt: null,
      createdAt: MONDAY,
      updatedAt: MONDAY,
      ...over,
    }) as Schedule;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        {
          provide: BlocksService,
          useValue: {
            assertBlockAccess: jest.fn().mockResolvedValue({ id: 'b1', workspaceId: 'ws-1' }),
          },
        },
        { provide: BlockEventsService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
    prisma = module.get(PrismaService);
    events = module.get(BlockEventsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a schedule when the block has none', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce(null);
    prisma.schedule.create.mockResolvedValueOnce(existing());

    await service.upsert('user-1', { blockId: 'b1', startDate: MONDAY });

    expect(prisma.schedule.create).toHaveBeenCalledWith({
      data: {
        blockId: 'b1',
        startDate: MONDAY,
        endDate: null,
        rrule: null,
        timezone: null,
        recurrenceMode: 'FIXED',
      },
    });
  });

  it('records nothing on the first schedule: nothing was moved', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce(null);
    prisma.schedule.create.mockResolvedValueOnce(existing());

    await service.upsert('user-1', { blockId: 'b1', startDate: MONDAY });

    expect(events.record).not.toHaveBeenCalled();
  });

  it('records block.rescheduled when the date moves', async () => {
    // The only source for "how many times have I pushed this back by hand".
    prisma.schedule.findUnique.mockResolvedValueOnce(existing());
    prisma.schedule.update.mockResolvedValueOnce(existing({ startDate: TUESDAY }));

    await service.upsert('user-1', { blockId: 'b1', startDate: TUESDAY });

    expect(events.record).toHaveBeenCalledWith(
      'block.rescheduled',
      expect.anything(),
      { from: MONDAY.toISOString(), to: TUESDAY.toISOString() },
      'user-1',
    );
  });

  it('does not record a move when only the rule changed', async () => {
    // Changing a frequency is not deferring, and counting it as one would make
    // the deferral counter lie.
    prisma.schedule.findUnique.mockResolvedValueOnce(existing());
    prisma.schedule.update.mockResolvedValueOnce(existing({ rrule: 'FREQ=DAILY' }));

    await service.upsert('user-1', {
      blockId: 'b1',
      startDate: MONDAY,
      rrule: 'FREQ=DAILY',
    });

    expect(events.record).not.toHaveBeenCalled();
  });

  it('stores the recurrence mode, which RFC 5545 cannot express', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce(null);
    prisma.schedule.create.mockResolvedValueOnce(existing());

    await service.upsert('user-1', {
      blockId: 'b1',
      startDate: MONDAY,
      rrule: 'FREQ=DAILY;INTERVAL=3',
      recurrenceMode: 'AFTER_COMPLETION',
    });

    expect(prisma.schedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ recurrenceMode: 'AFTER_COMPLETION' }),
    });
  });

  it('should find a schedule', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce({ id: 'sch-1' } as unknown as Schedule);
    await service.findOne('user-1', 'b1');
    expect(prisma.schedule.findUnique).toHaveBeenCalledWith({ where: { blockId: 'b1' } });
  });

  it('should remove a schedule', async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce({
      id: 'sch-1',
      blockId: 'b1',
    } as unknown as Schedule);
    prisma.schedule.delete.mockResolvedValueOnce({ id: 'sch-1' } as unknown as Schedule);
    await service.remove('user-1', 'sch-1');
    expect(prisma.schedule.delete).toHaveBeenCalledWith({ where: { id: 'sch-1' } });
  });
});
