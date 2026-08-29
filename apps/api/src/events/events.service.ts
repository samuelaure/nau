import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScopedPrismaService } from '../core/tenancy/scoped-prisma.service';
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
    await this.tenancy.assertBlockAccess(userId, blockId);

    return this.prisma.event.create({
      data: {
        blockId,
        type,
        metadata: metadata as Prisma.InputJsonValue,
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
}
