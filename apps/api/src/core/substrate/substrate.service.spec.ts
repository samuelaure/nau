import { NotFoundException, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { SubstrateService } from './substrate.service';
import { KindRegistryService } from '../kinds/kind-registry.service';
import type { ScopedPrismaService, ScopedPrismaClient } from '../tenancy/scoped-prisma.service';
import type { KindCapabilities } from '../kinds/kind.contract';

const base: KindCapabilities = {
  schedulable: false,
  taggable: true,
  syncable: true,
  nestable: true,
  softDeletable: true,
};

/** Invented kinds — the substrate must work for kinds it was never written for. */
const thing = {
  id: 'example.thing',
  schema: z.object({ text: z.string() }),
  capabilities: base,
};

/** Neither nestable nor soft-deletable, to prove both flags are honoured. */
const flat = {
  id: 'example.flat',
  schema: z.object({ n: z.number() }),
  capabilities: { ...base, nestable: false, softDeletable: false },
};

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'b1',
    uuid: 'u1',
    type: 'example.thing',
    properties: { text: 'hello' },
    workspaceId: 'ws-1',
    userId: 'u-1',
    parentId: null,
    source: null,
    sourceRef: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...over,
  };
}

describe('SubstrateService', () => {
  let kinds: KindRegistryService;
  let substrate: SubstrateService;
  let client: {
    block: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    kinds = new KindRegistryService();
    kinds.register(thing);
    kinds.register(flat);

    client = {
      block: {
        create: jest.fn().mockResolvedValue(row()),
        findUnique: jest.fn().mockResolvedValue(row()),
        findMany: jest.fn().mockResolvedValue([row()]),
        update: jest.fn().mockResolvedValue(row()),
        delete: jest.fn().mockResolvedValue(row()),
      },
    };

    substrate = new SubstrateService({} as ScopedPrismaService, kinds);
  });

  const as = () => client as unknown as ScopedPrismaClient;

  describe('create', () => {
    it('validates properties against the kind before writing', async () => {
      await expect(
        substrate.create(as(), { kind: 'example.thing', properties: { text: 42 } as never }),
      ).rejects.toThrow(BadRequestException);

      expect(client.block.create).not.toHaveBeenCalled();
    });

    it('refuses a kind nobody registered', async () => {
      await expect(
        substrate.create(as(), { kind: 'ghost.kind', properties: {} }),
      ).rejects.toThrow(/Unknown block kind/);
    });

    it('stores the kind in the type column and returns it as kind', async () => {
      const block = await substrate.create(as(), {
        kind: 'example.thing',
        properties: { text: 'hello' },
      });

      expect(client.block.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'example.thing' }) }),
      );
      expect(block.kind).toBe('example.thing');
    });

    it('never sets workspaceId itself — the scoped client owns that', async () => {
      await substrate.create(as(), { kind: 'example.thing', properties: { text: 'x' } });

      const data = client.block.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('workspaceId');
    });

    it('refuses a parent for a kind that is not nestable', async () => {
      await expect(
        substrate.create(as(), {
          kind: 'example.flat',
          properties: { n: 1 },
          parentId: 'b0',
        }),
      ).rejects.toThrow(/nestable/);
    });

    it('rejects a parent the scoped client cannot see', async () => {
      client.block.findUnique.mockResolvedValueOnce(null);

      await expect(
        substrate.create(as(), {
          kind: 'example.thing',
          properties: { text: 'x' },
          parentId: 'other-workspace-block',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('find', () => {
    it('excludes soft-deleted rows by default', async () => {
      await substrate.find(as(), { kind: 'example.thing' });

      expect(client.block.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('includes them when asked', async () => {
      await substrate.find(as(), { kind: 'example.thing', includeDeleted: true });

      const where = client.block.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('deletedAt');
    });

    it('throws on an unknown kind rather than returning an empty list', async () => {
      // An empty result for a typo is indistinguishable from an empty result
      // for real, and that ambiguity is how a broken query survives review.
      await expect(substrate.find(as(), { kind: 'ghost.kind' })).rejects.toThrow(
        /Unknown block kind/,
      );
    });

    it('treats a missing row as not found', async () => {
      client.block.findUnique.mockResolvedValueOnce(null);
      await expect(substrate.findOne(as(), 'nope')).rejects.toThrow(NotFoundException);
    });

    it('treats a soft-deleted row as not found', async () => {
      client.block.findUnique.mockResolvedValueOnce(row({ deletedAt: new Date() }));
      await expect(substrate.findOne(as(), 'b1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges the patch and validates the whole result', async () => {
      // Validating only the patch would let a partial update leave the row in
      // a shape its own schema rejects.
      await expect(
        substrate.update(as(), 'b1', { properties: { text: 99 } as never }),
      ).rejects.toThrow(BadRequestException);

      expect(client.block.update).not.toHaveBeenCalled();
    });

    it('keeps untouched fields when patching', async () => {
      client.block.findUnique.mockResolvedValue(
        row({ properties: { text: 'original' } }),
      );

      await substrate.update(as(), 'b1', { properties: {} });

      const data = client.block.update.mock.calls[0][0].data;
      expect(data.properties).toEqual({ text: 'original' });
    });

    it('refuses to make a block its own parent', async () => {
      await expect(substrate.update(as(), 'b1', { parentId: 'b1' })).rejects.toThrow(
        /own parent/,
      );
    });
  });

  describe('mutateKind', () => {
    it('validates the new properties against the destination kind, not the current one', async () => {
      // Currently `example.thing` ({ text }); mutating to `example.flat`
      // ({ n }) must reject a `text`-shaped payload, proving it checks the
      // kind being moved *to*, not the one the row already has.
      await expect(
        substrate.mutateKind(as(), 'b1', 'example.flat', { text: 'wrong shape' } as never),
      ).rejects.toThrow(BadRequestException);

      expect(client.block.update).not.toHaveBeenCalled();
    });

    it('writes both type and properties in the same update', async () => {
      client.block.update.mockResolvedValue(
        row({ type: 'example.flat', properties: { n: 1 } }),
      );

      await substrate.mutateKind(as(), 'b1', 'example.flat', { n: 1 });

      expect(client.block.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { type: 'example.flat', properties: { n: 1 } },
      });
    });

    it('returns the block under its new kind', async () => {
      client.block.update.mockResolvedValue(
        row({ type: 'example.flat', properties: { n: 1 } }),
      );

      const block = await substrate.mutateKind(as(), 'b1', 'example.flat', { n: 1 });
      expect(block.kind).toBe('example.flat');
    });

    it('refuses a destination kind nobody registered', async () => {
      await expect(
        substrate.mutateKind(as(), 'b1', 'ghost.kind', {}),
      ).rejects.toThrow(/Unknown block kind/);
    });
  });

  describe('remove honours what the kind declared', () => {
    it('soft-deletes a kind that declares softDeletable', async () => {
      await substrate.remove(as(), 'b1');

      expect(client.block.delete).not.toHaveBeenCalled();
      expect(client.block.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
      );
    });

    it('hard-deletes a kind that does not', async () => {
      client.block.findUnique.mockResolvedValue(
        row({ type: 'example.flat', properties: { n: 1 } }),
      );

      await substrate.remove(as(), 'b1');

      expect(client.block.delete).toHaveBeenCalled();
      expect(client.block.update).not.toHaveBeenCalled();
    });
  });
});
