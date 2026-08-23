import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { BlockEventsService } from '../blocks/block-events.service';

export interface UpsertScheduleInput {
  blockId: string;
  startDate: Date;
  endDate?: Date | null;
  rrule?: string | null;
  timezone?: string | null;
  recurrenceMode?: 'FIXED' | 'AFTER_COMPLETION';
}

@Injectable()
export class ScheduleService {
  constructor(
    private prisma: PrismaService,
    private blocks: BlocksService,
    private events: BlockEventsService,
  ) {}

  /**
   * Sets when a block is meant to happen.
   *
   * Moving an existing schedule records `block.rescheduled`. That event is the
   * only source for "how many times have I pushed this back by hand", which is
   * one of the two counters that make deferral visible — the other one is
   * arithmetic, and neither is a column anyone has to maintain.
   */
  async upsert(userId: string, input: UpsertScheduleInput) {
    const block = await this.blocks.assertBlockAccess(userId, input.blockId);
    const existing = await this.prisma.schedule.findUnique({
      where: { blockId: input.blockId },
    });

    const data = {
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      rrule: input.rrule ?? null,
      timezone: input.timezone ?? null,
      recurrenceMode: input.recurrenceMode ?? 'FIXED',
    };

    const moved =
      existing !== null &&
      (existing.startDate.getTime() !== input.startDate.getTime() ||
        (existing.endDate?.getTime() ?? null) !== (input.endDate?.getTime() ?? null));

    const schedule = existing
      ? await this.prisma.schedule.update({ where: { blockId: input.blockId }, data })
      : await this.prisma.schedule.create({ data: { blockId: input.blockId, ...data } });

    if (moved) {
      await this.events.record(
        'block.rescheduled',
        block,
        {
          from: existing!.startDate.toISOString(),
          to: input.startDate.toISOString(),
        },
        userId,
      );
    }

    return schedule;
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
