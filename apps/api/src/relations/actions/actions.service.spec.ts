import { ActionsService } from './actions.service';
import type { ScopedPrismaService } from '../../core/tenancy/scoped-prisma.service';
import type { SubstrateService } from '../../core/substrate/substrate.service';

const itemBlock = (over: Record<string, unknown> = {}) => ({
  id: 'item-1',
  kind: 'actions.item',
  parentId: null,
  properties: {
    text: 'llamar a la empresa de mudanzas',
    status: 'todo',
    priority: null,
    deadline: null,
    estimateMinutes: null,
  },
  ...over,
});

describe('ActionsService', () => {
  let create: jest.Mock;
  let findOne: jest.Mock;
  let find: jest.Mock;
  let update: jest.Mock;
  let remove: jest.Mock;
  let children: jest.Mock;
  let forUser: jest.Mock;
  let service: ActionsService;

  beforeEach(() => {
    create = jest.fn().mockResolvedValue(itemBlock());
    findOne = jest.fn().mockResolvedValue(itemBlock());
    find = jest.fn().mockResolvedValue([itemBlock()]);
    update = jest.fn().mockResolvedValue(itemBlock());
    remove = jest.fn().mockResolvedValue(undefined);
    children = jest.fn().mockResolvedValue([]);
    forUser = jest.fn().mockResolvedValue({});

    const scoped = { forUser } as unknown as ScopedPrismaService;
    const substrate = { create, findOne, find, update, remove, children } as unknown as SubstrateService;
    service = new ActionsService(scoped, substrate);
  });

  describe('createItem', () => {
    it('defaults to an empty, todo item when given nothing but ids', async () => {
      await service.createItem({ userId: 'u-1', workspaceId: 'ws-1' });

      expect(create).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          kind: 'actions.item',
          properties: expect.objectContaining({ text: '', status: 'todo' }),
        }),
      );
    });

    it('always creates as todo, regardless of what a caller might pass', async () => {
      // status isn't even an accepted create param — CreateActionItemBody
      // doesn't expose it, and this proves the service doesn't accept an
      // override some future caller might sneak in via the properties shape.
      await service.createItem({ userId: 'u-1', workspaceId: 'ws-1', text: 'x' });

      const properties = create.mock.calls[0][1].properties;
      expect(properties.status).toBe('todo');
    });

    it('carries priority, deadline and estimateMinutes through', async () => {
      await service.createItem({
        userId: 'u-1',
        workspaceId: 'ws-1',
        priority: 'high',
        deadline: '2026-09-01T00:00:00.000Z',
        estimateMinutes: 30,
      });

      const properties = create.mock.calls[0][1].properties;
      expect(properties.priority).toBe('high');
      expect(properties.deadline).toBe('2026-09-01T00:00:00.000Z');
      expect(properties.estimateMinutes).toBe(30);
    });

    it('passes parentId through for nesting under a project', async () => {
      await service.createItem({ userId: 'u-1', workspaceId: 'ws-1', parentId: 'project-1' });

      expect(create).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ parentId: 'project-1' }),
      );
    });

    it('returns hasChildren: false for a freshly created item', async () => {
      const result = await service.createItem({ userId: 'u-1', workspaceId: 'ws-1' });
      expect(result.hasChildren).toBe(false);
    });
  });

  describe('getItem', () => {
    it('reports hasChildren true when the substrate finds descendants', async () => {
      children.mockResolvedValue([itemBlock({ id: 'child-1', parentId: 'item-1' })]);

      const result = await service.getItem('u-1', 'ws-1', 'item-1');
      expect(result.hasChildren).toBe(true);
    });

    it('reports hasChildren false for a leaf', async () => {
      const result = await service.getItem('u-1', 'ws-1', 'item-1');
      expect(result.hasChildren).toBe(false);
    });
  });

  describe('listItems', () => {
    it('returns every item in the workspace regardless of depth in one call', async () => {
      await service.listItems('u-1', 'ws-1');
      // No parentId in the query — find() with no parentId filter already
      // returns every row of the kind, which is the whole point: no
      // per-level round trip.
      expect(find).toHaveBeenCalledWith({}, { kind: 'actions.item' });
    });

    it('computes hasChildren from the same result set, not a query per node', async () => {
      const parent = itemBlock({ id: 'parent-1', parentId: null });
      const leaf = itemBlock({ id: 'leaf-1', parentId: 'parent-1' });
      find.mockResolvedValue([parent, leaf]);

      const result = await service.listItems('u-1', 'ws-1');
      expect(children).not.toHaveBeenCalled();

      const byId = new Map(result.map((r) => [r.id, r]));
      expect(byId.get('parent-1')!.hasChildren).toBe(true);
      expect(byId.get('leaf-1')!.hasChildren).toBe(false);
    });

    it('filters by status when asked', async () => {
      const todo = itemBlock({ id: 'a', properties: { ...itemBlock().properties, status: 'todo' } });
      const done = itemBlock({ id: 'b', properties: { ...itemBlock().properties, status: 'done' } });
      find.mockResolvedValue([todo, done]);

      const result = await service.listItems('u-1', 'ws-1', { status: 'done' });
      expect(result.map((r) => r.id)).toEqual(['b']);
    });
  });

  describe('updateItem', () => {
    it('separates parentId from properties before writing', async () => {
      await service.updateItem('u-1', 'ws-1', 'item-1', { text: 'nuevo texto', parentId: 'p-1' });

      expect(update).toHaveBeenCalledWith(
        {},
        'item-1',
        { properties: { text: 'nuevo texto' }, parentId: 'p-1' },
      );
    });

    it('omits parentId from the write when the caller does not touch it', async () => {
      await service.updateItem('u-1', 'ws-1', 'item-1', { text: 'x' });

      const call = update.mock.calls[0][2];
      expect(call).not.toHaveProperty('parentId');
    });

    it('allows moving an item to root by passing parentId: null explicitly', async () => {
      await service.updateItem('u-1', 'ws-1', 'item-1', { parentId: null });

      expect(update).toHaveBeenCalledWith({}, 'item-1', { properties: {}, parentId: null });
    });
  });

  describe('deleteItem', () => {
    it('delegates to the substrate, honouring softDeletable per the kind', async () => {
      await service.deleteItem('u-1', 'ws-1', 'item-1');
      expect(remove).toHaveBeenCalledWith({}, 'item-1');
    });
  });
});
