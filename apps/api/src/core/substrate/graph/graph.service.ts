import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlocksService } from '../../../blocks/blocks.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class GraphService {
  constructor(
    private prisma: PrismaService,
    private blocks: BlocksService,
  ) {}

  async create(
    userId: string,
    fromBlockId: string,
    toBlockId: string,
    type: string,
    properties: Record<string, unknown> = {},
  ) {
    await this.blocks.assertBlockAccess(userId, fromBlockId);
    await this.blocks.assertBlockAccess(userId, toBlockId);

    return this.prisma.relation.create({
      data: {
        fromBlockId,
        toBlockId,
        type,
        properties: properties as Prisma.InputJsonValue,
      },
    });
  }

  async remove(userId: string, id: string) {
    const relation = await this.prisma.relation.findUnique({ where: { id } });
    if (!relation) throw new NotFoundException(`Relation ${id} not found`);

    await this.blocks.assertBlockAccess(userId, relation.fromBlockId);

    return this.prisma.relation.delete({ where: { id } });
  }
}
