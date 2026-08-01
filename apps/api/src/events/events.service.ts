import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private blocks: BlocksService,
  ) {}

  async create(
    userId: string,
    blockId: string,
    type: string,
    metadata: Record<string, unknown> = {},
  ) {
    await this.blocks.assertBlockAccess(userId, blockId);

    return this.prisma.event.create({
      data: {
        blockId,
        type,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async findByBlock(userId: string, blockId: string) {
    await this.blocks.assertBlockAccess(userId, blockId);

    return this.prisma.event.findMany({
      where: { blockId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
