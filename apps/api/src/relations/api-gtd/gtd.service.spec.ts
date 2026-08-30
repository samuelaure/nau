import { BadRequestException } from '@nestjs/common';
import { GtdService } from './gtd.service';
import type { ScopedPrismaService, ScopedPrismaClient } from '../../core/tenancy/scoped-prisma.service';
import type { SubstrateService } from '../../core/substrate/substrate.service';
import type { EventsService } from '../../core/substrate/events/events.service';
import { REFERENCES_NOTE_KIND } from '@nau/references';
import { ACTIONS_ITEM_KIND } from '@nau/actions';
import { JOURNAL_ENTRY_KIND } from '@nau/journal';

/**
 * Movements are stored as `Event` rows, never a table of their own — see
 * `gtd.service.ts`'s own doc comment for why. These tests exercise exactly
 * that mapping: `EventsService` is mocked at the same seam every other
 * relation's tests mock the substrate at, and the assertions check that
 * `currentTray`/`isOrdered` (real `@nau/gtd` functions, not reimplemented
 * here) get fed the history built from those rows correctly.
 */
function movementEvent(over: Partial<{ type: string; metadata: unknown; createdAt: Date; blockId: string }> = {}) {
  return {
    id: 'evt-1',
    type: 'gtd.capture',
    metadata: { from: null, to: 'inbox' },
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    blockId: 'b1',
    ...over,
  };
}

describe('GtdService', () => {
  let scoped: { forUser: jest.Mock };
  let substrate: {
    create: jest.Mock;
    findOne: jest.Mock;
    mutateKind: jest.Mock;
    update: jest.Mock;
  };
  let events: { create: jest.Mock; findByBlock: jest.Mock };
  let service: GtdService;
  const client = {} as ScopedPrismaClient;

  beforeEach(() => {
    scoped = { forUser: jest.fn().mockResolvedValue(client) };
    substrate = {
      create: jest.fn().mockResolvedValue({ id: 'b1', kind: REFERENCES_NOTE_KIND }),
      findOne: jest.fn().mockResolvedValue({ id: 'b1', properties: { content: 'hi' } }),
      mutateKind: jest.fn().mockResolvedValue({ id: 'b1' }),
      update: jest.fn().mockResolvedValue({ id: 'b1' }),
    };
    events = {
      create: jest.fn().mockResolvedValue(undefined),
      findByBlock: jest.fn().mockResolvedValue([]),
    };

    service = new GtdService(
      scoped as unknown as ScopedPrismaService,
      substrate as unknown as SubstrateService,
      events as unknown as EventsService,
    );
  });

  describe('capture', () => {
    it('creates a references.note, never any other kind', async () => {
      await service.capture({
        userId: 'u1',
        workspaceId: 'ws1',
        trayId: 'inbox',
        content: 'a thought',
      });

      expect(substrate.create).toHaveBeenCalledWith(
        client,
        expect.objectContaining({ kind: REFERENCES_NOTE_KIND }),
      );
    });

    it('records the capture as a gtd.capture event with the destination tray', async () => {
      await service.capture({ userId: 'u1', workspaceId: 'ws1', trayId: 'inbox', content: 'x' });

      expect(events.create).toHaveBeenCalledWith('u1', 'b1', 'gtd.capture', {
        from: null,
        to: 'inbox',
      });
    });
  });

  describe('process', () => {
    it('refuses to process an item with no current tray', async () => {
      events.findByBlock.mockResolvedValue([]);

      await expect(
        service.process({ userId: 'u1', blockId: 'b1', toTrayId: 'projects/x' }),
      ).rejects.toThrow(BadRequestException);
      expect(events.create).not.toHaveBeenCalled();
    });

    it('refuses to process an item that has already been ordered', async () => {
      // findByBlock returns newest-first, same as the real query; the order
      // event must sort after the capture for the fixture to mean what it says.
      events.findByBlock.mockResolvedValue([
        movementEvent({
          type: 'gtd.order',
          metadata: { from: 'inbox', to: null },
          createdAt: new Date('2026-08-02T00:00:00.000Z'),
        }),
        movementEvent({
          type: 'gtd.capture',
          metadata: { from: null, to: 'inbox' },
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        }),
      ]);

      await expect(
        service.process({ userId: 'u1', blockId: 'b1', toTrayId: 'projects/x' }),
      ).rejects.toThrow(/already been ordered/);
    });

    it('records a gtd.process event from the current tray to the target', async () => {
      events.findByBlock.mockResolvedValue([
        movementEvent({ type: 'gtd.capture', metadata: { from: null, to: 'inbox' } }),
      ]);

      await service.process({ userId: 'u1', blockId: 'b1', toTrayId: 'projects/x' });

      expect(events.create).toHaveBeenCalledWith('u1', 'b1', 'gtd.process', {
        from: 'inbox',
        to: 'projects/x',
      });
    });
  });

  describe('order', () => {
    it('refuses to order an item that was never captured into a tray', async () => {
      events.findByBlock.mockResolvedValue([]);

      await expect(
        service.order({
          userId: 'u1',
          workspaceId: 'ws1',
          destination: 'actions',
          order: { blockId: 'b1' },
        }),
      ).rejects.toThrow(/nothing to order/);
      expect(substrate.mutateKind).not.toHaveBeenCalled();
    });

    it('orders into actions via mutateKind, never a plain update', async () => {
      events.findByBlock.mockResolvedValue([
        movementEvent({ type: 'gtd.capture', metadata: { from: null, to: 'inbox' } }),
      ]);
      substrate.findOne.mockResolvedValue({ id: 'b1', properties: { content: 'do the thing' } });

      await service.order({
        userId: 'u1',
        workspaceId: 'ws1',
        destination: 'actions',
        order: { blockId: 'b1' },
      });

      expect(substrate.mutateKind).toHaveBeenCalledWith(
        client,
        'b1',
        ACTIONS_ITEM_KIND,
        expect.objectContaining({ status: 'todo' }),
      );
      expect(substrate.update).not.toHaveBeenCalled();
    });

    it('orders into journal via mutateKind with the journal.entry kind', async () => {
      events.findByBlock.mockResolvedValue([
        movementEvent({ type: 'gtd.capture', metadata: { from: null, to: 'inbox' } }),
      ]);
      // orderIntoJournal reads text/source/originFormat off the note's own
      // properties (per its own doc comment: a note already carries how it
      // was captured, nau#111) — content alone is not enough to convert it.
      substrate.findOne.mockResolvedValue({
        id: 'b1',
        properties: { text: 'hi', source: 'app', originFormat: 'text' },
      });

      await service.order({
        userId: 'u1',
        workspaceId: 'ws1',
        destination: 'journal',
        order: { blockId: 'b1' },
      });

      expect(substrate.mutateKind).toHaveBeenCalledWith(
        client,
        'b1',
        JOURNAL_ENTRY_KIND,
        expect.any(Object),
      );
    });

    it('orders into references via a plain update — the kind never changes', async () => {
      // Per nau#111/#117: references.note is already the kind. Ordering here
      // only clears the pending suggestion, never mutates type.
      events.findByBlock.mockResolvedValue([
        movementEvent({ type: 'gtd.capture', metadata: { from: null, to: 'inbox' } }),
      ]);
      substrate.findOne.mockResolvedValue({
        id: 'b1',
        properties: { title: null, content: 'x', attachments: [], suggestedType: 'actions' },
      });

      await service.order({
        userId: 'u1',
        workspaceId: 'ws1',
        destination: 'references',
        order: { blockId: 'b1' },
      });

      expect(substrate.update).toHaveBeenCalledWith(
        client,
        'b1',
        expect.objectContaining({
          properties: expect.objectContaining({ suggestedType: null }),
        }),
      );
      expect(substrate.mutateKind).not.toHaveBeenCalled();
    });

    it('records a gtd.order event that closes the item out of every tray', async () => {
      events.findByBlock.mockResolvedValue([
        movementEvent({
          type: 'gtd.process',
          metadata: { from: 'inbox', to: 'projects/x' },
          createdAt: new Date('2026-08-02T00:00:00.000Z'),
        }),
        movementEvent({
          type: 'gtd.capture',
          metadata: { from: null, to: 'inbox' },
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        }),
      ]);

      await service.order({
        userId: 'u1',
        workspaceId: 'ws1',
        destination: 'references',
        order: { blockId: 'b1' },
      });

      expect(events.create).toHaveBeenCalledWith('u1', 'b1', 'gtd.order', {
        from: 'projects/x',
        to: null,
      });
    });
  });

  describe('currentTray / isOrdered', () => {
    it('reflects the last movement recorded, oldest-first order restored from findByBlock', async () => {
      // findByBlock returns newest-first; the service must reverse it before
      // handing to @nau/gtd's functions, which assume oldest-first.
      events.findByBlock.mockResolvedValue([
        movementEvent({
          type: 'gtd.process',
          metadata: { from: 'inbox', to: 'projects/x' },
          createdAt: new Date('2026-08-02T00:00:00.000Z'),
        }),
        movementEvent({
          type: 'gtd.capture',
          metadata: { from: null, to: 'inbox' },
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        }),
      ]);

      expect(await service.currentTray('u1', 'b1')).toBe('projects/x');
      expect(await service.isOrdered('u1', 'b1')).toBe(false);
    });

    it('reports ordered once the last movement is a gtd.order', async () => {
      events.findByBlock.mockResolvedValue([
        movementEvent({ type: 'gtd.order', metadata: { from: 'inbox', to: null } }),
        movementEvent({ type: 'gtd.capture', metadata: { from: null, to: 'inbox' } }),
      ]);

      expect(await service.isOrdered('u1', 'b1')).toBe(true);
      expect(await service.currentTray('u1', 'b1')).toBeNull();
    });

    it('ignores non-gtd events recorded on the same block', async () => {
      events.findByBlock.mockResolvedValue([
        { id: 'e2', type: 'block.updated', metadata: {}, createdAt: new Date(), blockId: 'b1' },
        movementEvent({ type: 'gtd.capture', metadata: { from: null, to: 'inbox' } }),
      ]);

      expect(await service.currentTray('u1', 'b1')).toBe('inbox');
    });
  });
});
