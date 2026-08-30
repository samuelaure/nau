import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopedPrismaService } from '../../tenancy/scoped-prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private tenancy: ScopedPrismaService,
  ) {}

  async create(
    userId: string,
    blockId: string,
    type: string,
    metadata: Record<string, unknown> = {},
  ) {
    const block = await this.tenancy.assertBlockAccess(userId, blockId);

    return this.prisma.event.create({
      data: {
        blockId,
        type,
        metadata: metadata as Prisma.InputJsonValue,
        // Stamped explicitly rather than relying on a scoped client's
        // `scopedData`, because this method calls `this.prisma` directly
        // (its callers pass a userId, not an already-scoped client) — see
        // nau#125, where every Event row up to this fix carried
        // `workspaceId: null`, making a workspace-wide read impossible
        // without first knowing every blockId to ask about.
        workspaceId: block.workspaceId,
      },
    });
  }

  async findByBlock(userId: string, blockId: string) {
    await this.tenancy.assertBlockAccess(userId, blockId);

    return this.prisma.event.findMany({
      where: { blockId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Every event of a given type prefix across a workspace — the read a tray
   * listing needs (nau#125) and `findByBlock` cannot give: that one only
   * answers for a block already known, and listing a tray's contents starts
   * without any blockId at all.
   *
   * Membership is asserted directly rather than through `assertBlockAccess`
   * (there is no single block here) — same check `ScopedPrismaService.forUser`
   * performs, done inline because this service takes a bare userId/workspaceId
   * pair rather than an already-scoped client.
   */
  async findByWorkspaceAndTypePrefix(userId: string, workspaceId: string, typePrefix: string) {
    await this.tenancy.assertMembership(userId, workspaceId);

    return this.prisma.event.findMany({
      where: { workspaceId, type: { startsWith: typePrefix } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
