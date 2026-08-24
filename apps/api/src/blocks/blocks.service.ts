import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockEventsService } from './block-events.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';
import { FindBlocksQueryDto } from './dto/find-blocks-query.dto';
import { Prisma } from '@prisma/client';
import type {
  AccessTokenPayload,
  CreateBlockDto as InternalCreateBlockDto,
} from '@nau/types';

@Injectable()
export class BlocksService {
  constructor(
    private prisma: PrismaService,
    private events: BlockEventsService,
  ) {}

  async getMemberWorkspaceIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    return memberships.map((m) => m.workspaceId);
  }

  async assertWorkspaceMembership(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    return member;
  }

  /**
   * Loads a block only if the caller is a member of its workspace. Every
   * cross-service entry point that takes a blockId must go through this —
   * blocks carry personal journal content and are readable by id otherwise.
   */
  async assertBlockAccess(userId: string, blockId: string) {
    const block = await this.prisma.block.findUnique({ where: { id: blockId } });
    if (!block || block.deletedAt) {
      throw new NotFoundException(`Block with ID ${blockId} not found`);
    }
    if (!block.workspaceId) throw new ForbiddenException('Block has no workspace');
    await this.assertWorkspaceMembership(userId, block.workspaceId);
    return block;
  }

  async create(user: AccessTokenPayload, createBlockDto: CreateBlockDto) {
    const workspaceId = createBlockDto.workspaceId ?? user.workspaceId;
    await this.assertWorkspaceMembership(user.sub, workspaceId);

    if (createBlockDto.parentId) {
      await this.assertBlockAccess(user.sub, createBlockDto.parentId);
    }

    return this.createInternal({
      ...createBlockDto,
      workspaceId,
      userId: user.sub,
    });
  }

  /**
   * Unscoped create for service-authenticated callers (triage, journal cron).
   * Performs NO authorization — the caller is responsible for having
   * established the trust boundary. Never reachable from a user-facing route.
   */
  async createInternal(createBlockDto: InternalCreateBlockDto) {
    const { parentId, type, properties, workspaceId, userId } = createBlockDto;

    let sortOrder = 1;

    const siblings = await this.prisma.block.findMany({
      where: { parentId: parentId ?? null, type, ...(workspaceId && { workspaceId }) },
    });

    const lastSibling = siblings.sort((a, b) => {
      const sortOrderA =
        ((a.properties as Prisma.JsonObject)?.sortOrder as number) || 0;
      const sortOrderB =
        ((b.properties as Prisma.JsonObject)?.sortOrder as number) || 0;
      return sortOrderB - sortOrderA;
    })[0];

    if (
      lastSibling &&
      lastSibling.properties !== null &&
      typeof (lastSibling.properties as Prisma.JsonObject).sortOrder === 'number'
    ) {
      sortOrder =
        ((lastSibling.properties as Prisma.JsonObject).sortOrder as number) + 1;
    }

    const data: Prisma.BlockCreateInput = {
      type,
      properties: {
        ...((properties as Prisma.JsonObject) || {}),
        sortOrder,
      },
      ...(parentId && { parent: { connect: { id: parentId } } }),
      ...(workspaceId && { workspace: { connect: { id: workspaceId } } }),
      userId: userId ?? null,
    };

    const created = await this.prisma.block.create({ data });
    await this.events.record('block.created', created, { blockType: type }, userId);
    return created;
  }

  /**
   * Unscoped read for service-authenticated callers. See createInternal.
   */
  async findAllInternal(query: FindBlocksQueryDto) {
    const { type, status, workspaceId } = query;
    const where: Prisma.BlockWhereInput = { deletedAt: null };

    if (workspaceId) where.workspaceId = workspaceId;
    if (type) where.type = type;
    where.properties = status
      ? { path: ['status'], equals: status }
      : { path: ['status'], not: 'trash' };

    const blocks = await this.prisma.block.findMany({ where });
    return this.sortByDateThenOrder(blocks);
  }

  /**
   * Unscoped update for service-authenticated callers. See createInternal.
   */
  async updateInternal(id: string, updateBlockDto: UpdateBlockDto) {
    const block = await this.prisma.block.findUnique({ where: { id } });
    if (!block) throw new NotFoundException(`Block with ID ${id} not found`);
    return this.applyUpdate(id, block, updateBlockDto);
  }

  async findAll(userId: string, query: FindBlocksQueryDto) {
    const { type, status, workspaceId, types, from, to, limit } = query;

    const memberWorkspaceIds = await this.getMemberWorkspaceIds(userId);
    if (memberWorkspaceIds.length === 0) return [];

    if (workspaceId && !memberWorkspaceIds.includes(workspaceId)) {
      throw new ForbiddenException('Not a member of this workspace');
    }

    const where: Prisma.BlockWhereInput = {
      deletedAt: null,
      workspaceId: workspaceId ? workspaceId : { in: memberWorkspaceIds },
    };

    if (type) where.type = type;
    if (types) where.type = { in: types.split(',').map((t) => t.trim()).filter(Boolean) };

    // Several conditions can apply to `properties` at once, and a single object
    // would let the last one silently replace the others.
    const propertyFilters: Prisma.BlockWhereInput[] = [
      status
        ? { properties: { path: ['status'], equals: status } }
        : { properties: { path: ['status'], not: 'trash' } },
    ];

    // Range filtering happens here rather than in the browser. The journal view
    // used to fetch every block in the workspace — including 968 Instagram
    // captures — to render a single day.
    if (from) propertyFilters.push({ properties: { path: ['date'], gte: from } });
    if (to) propertyFilters.push({ properties: { path: ['date'], lte: to } });

    where.AND = propertyFilters;

    const blocks = await this.prisma.block.findMany({
      where,
      // The schedule travels with the block. When something is due is not a
      // property of the block — it lives in its own table — and a view that
      // cannot see it has to guess, which is how `properties.date` came to mean
      // two different things in two different screens.
      include: { schedule: { include: { exceptions: true } } },
      ...(limit ? { take: Math.min(Number(limit) || 200, 1000) } : {}),
    });
    return this.sortByDateThenOrder(blocks);
  }

  async update(userId: string, id: string, updateBlockDto: UpdateBlockDto) {
    const block = await this.assertBlockAccess(userId, id);

    if (updateBlockDto.parentId) {
      await this.assertBlockAccess(userId, updateBlockDto.parentId);
    }

    return this.applyUpdate(id, block, updateBlockDto, userId);
  }

  private async applyUpdate(
    id: string,
    block: { id?: string; workspaceId?: string | null; userId?: string | null; properties: Prisma.JsonValue },
    updateBlockDto: UpdateBlockDto,
    actorUserId?: string,
  ) {
    const { type, properties, parentId } = updateBlockDto;
    const data: Prisma.BlockUpdateInput = {};

    if (type) {
      data.type = type;
    }

    if (properties) {
      const currentProperties = (block.properties as Prisma.JsonObject) || {};
      data.properties = {
        ...currentProperties,
        ...(properties as Prisma.InputJsonObject),
      };
    }

    if (parentId !== undefined) {
      data.parent =
        parentId === null
          ? { disconnect: true }
          : { connect: { id: parentId } };
    }

    const updated = await this.prisma.block.update({ where: { id }, data });
    await this.events.recordUpdate({ ...block, id }, updated, actorUserId);
    return updated;
  }

  private sortByDateThenOrder<T extends { properties: Prisma.JsonValue }>(
    blocks: T[],
  ): T[] {
    return blocks.sort((a, b) => {
      const dateA = (a.properties as Prisma.JsonObject)?.date as string;
      const dateB = (b.properties as Prisma.JsonObject)?.date as string;
      const sortOrderA =
        ((a.properties as Prisma.JsonObject)?.sortOrder as number) || 0;
      const sortOrderB =
        ((b.properties as Prisma.JsonObject)?.sortOrder as number) || 0;

      if (dateA && dateB) {
        if (dateA > dateB) return -1;
        if (dateA < dateB) return 1;
      }

      return sortOrderA - sortOrderB;
    });
  }

  async findOne(userId: string, id: string) {
    await this.assertBlockAccess(userId, id);

    return this.prisma.block.findUnique({
      where: { id },
      include: {
        children: true,
        relationsFrom: true,
        relationsTo: true,
        schedule: true,
      },
    });
  }

  async getRemindableBlocks(userId: string) {
    const memberWorkspaceIds = await this.getMemberWorkspaceIds(userId);
    if (memberWorkspaceIds.length === 0) return [];

    return this.prisma.block.findMany({
      where: {
        deletedAt: null,
        workspaceId: { in: memberWorkspaceIds },
        schedule: { isNot: null },
      },
      include: { schedule: true },
    });
  }

  async remove(userId: string, id: string) {
    const block = await this.assertBlockAccess(userId, id);
    const removed = await this.prisma.block.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.events.record('block.deleted', block, { blockType: block.type }, userId);
    return removed;
  }

  async addTag(userId: string, blockId: string, tagId: string) {
    const block = await this.assertBlockAccess(userId, blockId);

    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException(`Tag ${tagId} not found`);
    if (tag.workspaceId !== block.workspaceId) {
      throw new ForbiddenException('Tag belongs to a different workspace');
    }

    const link = await this.prisma.blockTag.create({
      data: { blockId, tagId },
    });
    await this.events.record('block.tagged', block, { tagId, tagName: tag.name }, userId);
    return link;
  }

  async removeTag(userId: string, blockId: string, tagId: string) {
    const block = await this.assertBlockAccess(userId, blockId);
    const removed = await this.prisma.blockTag.delete({
      where: { blockId_tagId: { blockId, tagId } },
    });
    await this.events.record('block.untagged', block, { tagId }, userId);
    return removed;
  }
}
