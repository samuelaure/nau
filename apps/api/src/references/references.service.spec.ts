import { ReferencesService } from './references.service';
import type { ScopedPrismaService } from '../core/tenancy/scoped-prisma.service';
import type { SubstrateService } from '../core/substrate/substrate.service';
import type { ReviewIntent } from '@nau/references';

const noteBlock = (over: Record<string, unknown> = {}) => ({
  id: 'note-1',
  kind: 'references.note',
  properties: {
    text: 'llamar a la empresa de mudanzas',
    content: 'llamar a la empresa de mudanzas',
    suggestedType: 'action',
  },
  ...over,
});

describe('ReferencesService.orderIntoActions', () => {
  let findOne: jest.Mock;
  let mutateKind: jest.Mock;
  let forUser: jest.Mock;
  let service: ReferencesService;

  beforeEach(() => {
    findOne = jest.fn().mockResolvedValue(noteBlock());
    mutateKind = jest.fn().mockResolvedValue(
      noteBlock({ kind: 'actions.item', properties: { text: 'llamar a la empresa de mudanzas', status: 'todo', priority: null, deadline: null } }),
    );
    forUser = jest.fn().mockResolvedValue({});

    const scoped = { forUser } as unknown as ScopedPrismaService;
    const substrate = { findOne, mutateKind } as unknown as SubstrateService;
    service = new ReferencesService(scoped, substrate);
  });

  it('reads the existing note before deciding the new properties', async () => {
    await service.orderIntoActions('u-1', 'ws-1', { blockId: 'note-1', suggestedText: 'x' } as never);
    expect(findOne).toHaveBeenCalledWith({}, 'note-1');
  });

  it('mutates the block to actions.item, never creating a second one', async () => {
    await service.orderIntoActions('u-1', 'ws-1', { blockId: 'note-1' } as never);

    expect(mutateKind).toHaveBeenCalledWith(
      {},
      'note-1',
      'actions.item',
      expect.objectContaining({ status: 'todo' }),
    );
  });

  it('carries the note text through when the order supplies no correction', async () => {
    await service.orderIntoActions('u-1', 'ws-1', { blockId: 'note-1' } as never);

    const properties = mutateKind.mock.calls[0][3];
    expect(properties.text).toBe('llamar a la empresa de mudanzas');
  });

  it('applies a text correction from the order over the note', async () => {
    await service.orderIntoActions('u-1', 'ws-1', {
      blockId: 'note-1',
      text: 'texto corregido',
    } as never);

    const properties = mutateKind.mock.calls[0][3];
    expect(properties.text).toBe('texto corregido');
  });

  it('carries priority and deadline from the order', async () => {
    await service.orderIntoActions('u-1', 'ws-1', {
      blockId: 'note-1',
      priority: 'high',
      deadline: '2026-09-01T00:00:00.000Z',
    } as never);

    const properties = mutateKind.mock.calls[0][3];
    expect(properties.priority).toBe('high');
    expect(properties.deadline).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('ReferencesService.orderIntoReferences', () => {
  let findOne: jest.Mock;
  let update: jest.Mock;
  let forUser: jest.Mock;
  let service: ReferencesService;

  beforeEach(() => {
    findOne = jest.fn().mockResolvedValue(
      noteBlock({
        properties: {
          title: 'Ideas de vacaciones',
          content: 'Portugal en primavera',
          attachments: [],
          suggestedType: 'references.note',
        },
      }),
    );
    update = jest.fn().mockResolvedValue(noteBlock());
    forUser = jest.fn().mockResolvedValue({});

    const scoped = { forUser } as unknown as ScopedPrismaService;
    const substrate = { findOne, update } as unknown as SubstrateService;
    service = new ReferencesService(scoped, substrate);
  });

  it('reads the existing note before deciding the new properties', async () => {
    await service.orderIntoReferences('u-1', 'ws-1', { blockId: 'note-1' });
    expect(findOne).toHaveBeenCalledWith({}, 'note-1');
  });

  it('never mutates the kind — it is already references.note, per nau#111', async () => {
    await service.orderIntoReferences('u-1', 'ws-1', { blockId: 'note-1' });

    expect(update).toHaveBeenCalledWith(
      {},
      'note-1',
      expect.objectContaining({
        properties: expect.objectContaining({ suggestedType: null }),
      }),
    );
  });

  it('clears suggestedType while leaving title, content and attachments untouched', async () => {
    await service.orderIntoReferences('u-1', 'ws-1', { blockId: 'note-1' });

    const properties = update.mock.calls[0][2].properties;
    expect(properties.suggestedType).toBeNull();
    expect(properties.title).toBe('Ideas de vacaciones');
    expect(properties.content).toBe('Portugal en primavera');
  });
});

describe('ReferencesService.hasPendingReviewAggregate', () => {
  const intent = (over: Partial<ReviewIntent> = {}): ReviewIntent => ({
    noteId: 'note-1',
    actionItemId: 'action-1',
    elevated: false,
    ...over,
  });

  // Pure delegation to @nau/references' own hasPendingReviews — no Time
  // resolution happens inside this method (nau#120's open question 3: the
  // caller supplies isOverdue, this method never resolves it itself).
  const service = new ReferencesService({} as never, {} as never);

  it('is false with no intents at all', () => {
    expect(service.hasPendingReviewAggregate([], () => true)).toBe(false);
  });

  it('is true when a non-elevated intent is overdue', () => {
    const intents = [intent({ actionItemId: 'a' })];
    expect(service.hasPendingReviewAggregate(intents, (id) => id === 'a')).toBe(true);
  });

  it('is false when the only overdue intent is elevated', () => {
    const intents = [intent({ actionItemId: 'a', elevated: true })];
    expect(service.hasPendingReviewAggregate(intents, (id) => id === 'a')).toBe(false);
  });
});
