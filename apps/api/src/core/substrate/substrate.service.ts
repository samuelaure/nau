import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ScopedPrismaService, type ScopedPrismaClient } from '../tenancy/scoped-prisma.service';
import { KindRegistryService } from '../kinds/kind-registry.service';
import type {
  Block,
  CreateBlockInput,
  UpdateBlockInput,
  FindBlocksQuery,
} from './substrate.contract';

/**
 * Persistence for the substance of a block.
 *
 * What this deliberately does not do
 * ----------------------------------
 * It never reads a property, never branches on what a block means, and never
 * holds a list of kinds. Every question of meaning is delegated to the kind
 * registry, which answers from what the owning module declared.
 *
 * That restraint is the point. The service this replaces resolved time periods,
 * created plannings, attached tags, computed sort order from its siblings'
 * properties and enforced membership — five modules' concerns in one class,
 * which is why a change to any of them had to be chased through all of it.
 *
 * Scoping is not this class's job either: it receives an already-scoped client,
 * so a query that crosses a workspace is not something it could express even by
 * mistake.
 */
@Injectable()
export class SubstrateService {
  constructor(
    private readonly scoped: ScopedPrismaService,
    private readonly kinds: KindRegistryService,
  ) {}

  /**
   * Rows are stored with the kind in the `type` column.
   *
   * The column keeps its name for now — renaming it is a migration, and the
   * rebuild deliberately changes no data before the coordinated deploy. The
   * contract calls it `kind` because that is what it is; the mapping is
   * confined to this file so nothing above has to know.
   */
  private toBlock<T>(row: {
    id: string;
    uuid: string;
    type: string;
    properties: unknown;
    workspaceId: string | null;
    userId: string | null;
    parentId: string | null;
    source: string | null;
    sourceRef: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): Block<T> {
    return {
      id: row.id,
      uuid: row.uuid,
      kind: row.type,
      properties: row.properties as T,
      // Non-null in practice and enforced by the tenancy layer; the column is
      // still nullable in the schema until nau#67 tightens it, and the census
      // confirmed every existing row already carries one.
      workspaceId: row.workspaceId as string,
      userId: row.userId,
      parentId: row.parentId,
      source: row.source,
      sourceRef: row.sourceRef,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  async create<T>(
    client: ScopedPrismaClient,
    input: CreateBlockInput<T>,
  ): Promise<Block<T>> {
    const properties = this.kinds.validate(input.kind, input.properties);

    if (input.parentId) {
      this.kinds.assertCapability(input.kind, 'nestable');
      // Reached through the scoped client, so a parent in another workspace is
      // not found rather than silently adopted.
      const parent = await client.block.findUnique({ where: { id: input.parentId } });
      if (!parent) throw new NotFoundException(`Parent block ${input.parentId} not found`);
    }

    const row = await client.block.create({
      data: {
        type: input.kind,
        properties: properties as object,
        parentId: input.parentId ?? null,
        userId: input.userId ?? null,
        source: input.source ?? null,
        sourceRef: input.sourceRef ?? null,
      },
    });

    return this.toBlock<T>(row);
  }

  async findOne<T>(client: ScopedPrismaClient, id: string): Promise<Block<T>> {
    const row = await client.block.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException(`Block ${id} not found`);
    return this.toBlock<T>(row);
  }

  async find<T>(
    client: ScopedPrismaClient,
    query: FindBlocksQuery,
  ): Promise<Block<T>[]> {
    // Unknown kinds throw rather than returning nothing: an empty list for a
    // typo is indistinguishable from an empty list for real, and that
    // ambiguity is how a broken query survives review.
    this.kinds.get(query.kind);

    const rows = await client.block.findMany({
      where: {
        type: query.kind,
        ...(query.parentId !== undefined && { parentId: query.parentId }),
        ...(query.includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      ...(query.take !== undefined && { take: query.take }),
      ...(query.skip !== undefined && { skip: query.skip }),
    });

    return rows.map((row) => this.toBlock<T>(row));
  }

  async update<T>(
    client: ScopedPrismaClient,
    id: string,
    input: UpdateBlockInput<T>,
  ): Promise<Block<T>> {
    const current = await this.findOne<T>(client, id);

    let properties = current.properties;
    if (input.properties !== undefined) {
      // Merged, then validated whole. Validating only the patch would let a
      // partial update leave the row in a shape its own schema rejects.
      properties = this.kinds.validate(current.kind, {
        ...(current.properties as object),
        ...(input.properties as object),
      }) as T;
    }

    if (input.parentId !== undefined && input.parentId !== null) {
      this.kinds.assertCapability(current.kind, 'nestable');
      if (input.parentId === id) {
        throw new BadRequestException('A block cannot be its own parent');
      }
    }

    const row = await client.block.update({
      where: { id },
      data: {
        properties: properties as object,
        ...(input.parentId !== undefined && { parentId: input.parentId }),
      },
    });

    return this.toBlock<T>(row);
  }

  /**
   * Removes a block, honouring what its kind declared.
   *
   * A kind that declares `softDeletable` is stamped rather than removed; one
   * that does not is deleted outright. The caller does not choose — that would
   * put the decision in twenty places instead of one.
   */
  async remove(client: ScopedPrismaClient, id: string): Promise<void> {
    const block = await this.findOne(client, id);
    const kind = this.kinds.get(block.kind);

    if (kind.capabilities.softDeletable) {
      await client.block.update({ where: { id }, data: { deletedAt: new Date() } });
      return;
    }

    await client.block.delete({ where: { id } });
  }

  /** Children of a block, in the tree. */
  async children<T>(client: ScopedPrismaClient, parentId: string): Promise<Block<T>[]> {
    const rows = await client.block.findMany({
      where: { parentId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toBlock<T>(row));
  }
}
