import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { gregorian, type Interval, type SystemId } from '@nau/time';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { BlockEventsService } from '../blocks/block-events.service';
import { WorkspaceTimeService } from './workspace-time.service';

/**
 * Where a block sits in time.
 *
 * A plan is identified by {system, scale, anchor} — which time system it was
 * placed in, which of that system's scales, and an instant inside the period.
 * The triple names the period rather than measuring it, so it keeps meaning the
 * same thing after a timezone change with nothing to migrate.
 *
 * `from`/`to` are resolved from that triple and stored only so a query can use
 * an index instead of resolving every system in memory. They are derived, never
 * authoritative, and `resolveInterval` is the single place they are computed.
 */

export interface UpsertPlanningInput {
  blockId: string;
  system?: SystemId;
  scale?: string;
  /** Any instant inside the period being planned into. */
  anchor: Date;
  recurrence?: string | null;
  recurrenceTimezone?: string | null;
  recurrenceMode?: 'FIXED' | 'AFTER_COMPLETION';
  /** When the rule stops applying. Null repeats indefinitely. */
  recurrenceUntil?: Date | null;
}

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
    private readonly events: BlockEventsService,
    private readonly time: WorkspaceTimeService,
  ) {}

  /**
   * Turns an identity into the span it occupies.
   *
   * The one place the derived cache is produced, so it cannot drift between
   * callers. Moving a block from a week to a month is a change of `scale`, and
   * the interval follows from it — never the other way round.
   */
  async resolveInterval(
    workspaceId: string,
    system: SystemId,
    scale: string,
    anchor: Date,
  ): Promise<Interval> {
    const ctx = await this.time.resolveContext(workspaceId, system, anchor);
    const period = this.time.registry_().get(system).periodAt(scale, anchor, ctx);

    if (!period) {
      throw new BadRequestException(
        `The ${system} system has no ${scale} period containing that instant`,
      );
    }

    return period.interval;
  }

  /**
   * Sets when a block is meant to happen.
   *
   * Moving an existing plan records `block.rescheduled`. That event is the only
   * source for "how many times have I pushed this back", which is one of the
   * two counters that make deferral visible — neither is a column anyone has to
   * maintain.
   */
  async upsert(userId: string, input: UpsertPlanningInput) {
    const block = await this.blocks.assertBlockAccess(userId, input.blockId);
    if (!block.workspaceId) {
      throw new BadRequestException('A block must belong to a workspace to be planned');
    }

    const system = input.system ?? gregorian.id;
    const scale = input.scale ?? 'day';
    const interval = await this.resolveInterval(block.workspaceId, system, scale, input.anchor);

    const existing = await this.prisma.planning.findUnique({
      where: { blockId: input.blockId },
    });

    const data = {
      system,
      scale,
      anchor: input.anchor,
      from: interval.start,
      // An open-ended period has no end; the column does not permit null, so a
      // system that produces one cannot be planned into yet. Gregorian never
      // does, which is why this is an assertion rather than a branch.
      to: interval.end ?? interval.start,
      recurrence: input.recurrence ?? null,
      recurrenceTimezone: input.recurrenceTimezone ?? null,
      recurrenceMode: input.recurrenceMode ?? ('FIXED' as const),
      recurrenceUntil: input.recurrenceUntil ?? null,
    };

    const moved =
      existing !== null &&
      (existing.anchor.getTime() !== input.anchor.getTime() ||
        existing.scale !== scale ||
        existing.system !== system);

    const planning = existing
      ? await this.prisma.planning.update({ where: { blockId: input.blockId }, data })
      : await this.prisma.planning.create({ data: { blockId: input.blockId, ...data } });

    if (moved) {
      await this.events.record(
        'block.rescheduled',
        block,
        {
          from: existing!.anchor.toISOString(),
          to: input.anchor.toISOString(),
          fromScale: existing!.scale,
          toScale: scale,
        },
        userId,
      );
    }

    return planning;
  }

  async findOne(userId: string, blockId: string) {
    await this.blocks.assertBlockAccess(userId, blockId);
    return this.prisma.planning.findUnique({ where: { blockId } });
  }

  async remove(userId: string, id: string) {
    const planning = await this.prisma.planning.findUnique({ where: { id } });
    if (!planning) throw new NotFoundException(`Planning ${id} not found`);

    await this.blocks.assertBlockAccess(userId, planning.blockId);

    return this.prisma.planning.delete({ where: { id } });
  }

  /**
   * Recomputes every stored interval for a workspace.
   *
   * Needed after a timezone change or a config change, because the interval is
   * derived: the identity still names the same period, but the instants that
   * period occupies have moved. Without this the cache would disagree with the
   * truth it was built from, which is the exact failure the identity was chosen
   * to avoid.
   */
  async reindexWorkspace(workspaceId: string): Promise<number> {
    const plannings = await this.prisma.planning.findMany({
      where: { block: { workspaceId } },
      select: { id: true, system: true, scale: true, anchor: true },
    });

    let updated = 0;
    for (const planning of plannings) {
      try {
        const interval = await this.resolveInterval(
          workspaceId,
          planning.system,
          planning.scale,
          planning.anchor,
        );
        await this.prisma.planning.update({
          where: { id: planning.id },
          data: { from: interval.start, to: interval.end ?? interval.start },
        });
        updated += 1;
      } catch {
        // One unresolvable row must not stop the rest. It stays as it was,
        // which is the previous answer rather than a wrong new one.
      }
    }

    return updated;
  }
}
