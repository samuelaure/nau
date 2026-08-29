import { Test, TestingModule } from '@nestjs/testing';
import { BlockEventsService } from './block-events.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  Prisma: {},
}));

describe('BlockEventsService', () => {
  let service: BlockEventsService;
  let create: jest.Mock;

  const block = { id: 'b1', workspaceId: 'ws-1', userId: 'owner-1' };

  const typesRecorded = () => create.mock.calls.map((c) => c[0].data.type);

  beforeEach(async () => {
    create = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockEventsService,
        { provide: PrismaService, useValue: { event: { create } } },
      ],
    }).compile();

    service = module.get(BlockEventsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('denormalises workspace and actor so a day can be queried without a join', async () => {
    await service.record('block.created', block, { blockType: 'action' }, 'actor-9');

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'block.created',
        blockId: 'b1',
        workspaceId: 'ws-1',
        userId: 'actor-9',
        metadata: { blockType: 'action' },
      }),
    });
  });

  it('falls back to the block owner when there is no acting user', async () => {
    await service.record('block.created', block);

    expect(create.mock.calls[0]![0].data.userId).toBe('owner-1');
  });

  it('never lets a logging failure break the mutation it describes', async () => {
    // The log is valuable; the user's data is essential.
    create.mockRejectedValue(new Error('database on fire'));

    await expect(service.record('block.created', block)).resolves.toBeUndefined();
  });

  describe('recordUpdate', () => {
    const withStatus = (status?: string) => ({ properties: status ? { status } : {} });

    it('records a plain edit when the status did not move', async () => {
      await service.recordUpdate({ ...block, ...withStatus('todo') }, withStatus('todo'));

      expect(typesRecorded()).toEqual(['block.updated']);
    });

    it('names a completion as its own event, which is what "finished today" reads', async () => {
      await service.recordUpdate({ ...block, ...withStatus('todo') }, withStatus('done'));

      expect(typesRecorded()).toEqual(['block.status_changed', 'block.completed']);
      expect(create.mock.calls[0]![0].data.metadata).toEqual({ from: 'todo', to: 'done' });
    });

    it('still accepts "completed" as legacy spelling of done, until nau#101 backfills it', async () => {
      await service.recordUpdate({ ...block, ...withStatus('todo') }, withStatus('completed'));

      expect(typesRecorded()).toContain('block.completed');
    });

    it('records a reopening when something done goes back to open', async () => {
      await service.recordUpdate({ ...block, ...withStatus('done') }, withStatus('todo'));

      expect(typesRecorded()).toEqual(['block.status_changed', 'block.reopened']);
    });

    it('does not re-record a completion when one resolved status becomes another', async () => {
      await service.recordUpdate({ ...block, ...withStatus('done') }, withStatus('completed'));

      expect(typesRecorded()).toEqual(['block.status_changed']);
    });

    // Cancelling is a third outcome, not a synonym for done — but from the
    // log's point of view both stop the item being pending, which is what
    // 'block.completed' actually records. `metadata.to` is what lets a reader
    // tell the two apart afterwards.
    it('names cancelling as a completion too, with the outcome in its metadata', async () => {
      await service.recordUpdate({ ...block, ...withStatus('todo') }, withStatus('cancelled'));

      expect(typesRecorded()).toEqual(['block.status_changed', 'block.completed']);
      expect(create.mock.calls[1]![0].data.metadata).toEqual({ from: 'todo', to: 'cancelled' });
    });

    it('does not re-record a completion when done becomes cancelled', async () => {
      await service.recordUpdate({ ...block, ...withStatus('done') }, withStatus('cancelled'));

      expect(typesRecorded()).toEqual(['block.status_changed']);
    });

    it('records a reopening when a cancelled item goes back to open', async () => {
      await service.recordUpdate({ ...block, ...withStatus('cancelled') }, withStatus('todo'));

      expect(typesRecorded()).toEqual(['block.status_changed', 'block.reopened']);
    });
  });
});
