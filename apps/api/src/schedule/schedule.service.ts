import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';

@Injectable()
export class ScheduleService {
  constructor(
    private prisma: PrismaService,
    private blocks: BlocksService,
  ) {}

  async upsert(
    userId: string,
    blockId: string,
    startDate: Date,
    endDate?: Date,
    rrule?: string,
  ) {
    await this.blocks.assertBlockAccess(userId, blockId);

    return this.prisma.schedule.upsert({
      where: { blockId },
      create: { blockId, startDate, endDate, rrule },
      update: { startDate, endDate, rrule },
    });
  }

  async findOne(userId: string, blockId: string) {
    await this.blocks.assertBlockAccess(userId, blockId);
    return this.prisma.schedule.findUnique({ where: { blockId } });
  }

  async remove(userId: string, id: string) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException(`Schedule ${id} not found`);

    await this.blocks.assertBlockAccess(userId, schedule.blockId);

    return this.prisma.schedule.delete({ where: { id } });
  }
}
