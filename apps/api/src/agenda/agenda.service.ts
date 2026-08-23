import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { BlockEventsService } from '../blocks/block-events.service';
import { occurrencesIn } from '../schedule/occurrences';
import { dayjs, dayIn, periodBounds, safeZone, type PeriodType } from '../common/time';

/** Block types that belong on an agenda. */
const AGENDA_TYPES = ['action', 'habit', 'appointment'];

export interface AgendaItem {
  blockId: string;
  type: string;
  title: string;
  /** The instant the schedule predicted — the key completion is recorded against. */
  occurrenceAt: string;
  /** Where it actually falls. Differs only when the occurrence was moved. */
  effectiveAt: string;
  moved: boolean;
  /** True when the schedule spans more than the day: due *within* the period. */
  spansPeriod: boolean;
  recurring: boolean;
  done: boolean;
  sortOrder: number;
  estimateMinutes: number | null;
  priority: string | null;
}

/**
 * One list of everything due in a period, whatever kind of thing it is.
 *
 * Habits and actions are shown together and ordered together, because that is
 * how a day is actually lived — every tool that separates them into two panes
 * forces the person to hold the merge in their head. Ticking either one records
 * the same way; only what it means differs.
 */
@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
    private readonly events: BlockEventsService,
  ) {}

  private async workspaceTimezone(workspaceId: string): Promise<string> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { timezone: true },
    });
    return safeZone(ws?.timezone);
  }

  async forPeriod(params: {
    userId: string;
    workspaceId: string;
    period: PeriodType;
    /** Any date inside the period being asked about. */
    date: string;
  }) {
    await this.blocks.assertWorkspaceMembership(params.userId, params.workspaceId);

    const tz = await this.workspaceTimezone(params.workspaceId);
    const ref = dayIn(params.date, tz).toDate();
    const { start, end, label } = periodBounds(params.period, tz, ref);

    // Every scheduled block in the workspace whose schedule could reach into the
    // window. A recurring schedule has no end, so it cannot be filtered by
    // startDate alone — the rule decides, and the rule is evaluated below.
    const scheduled = await this.prisma.block.findMany({
      where: {
        workspaceId: params.workspaceId,
        deletedAt: null,
        type: { in: AGENDA_TYPES },
        schedule: { is: { startDate: { lte: end } } },
      },
      include: { schedule: { include: { exceptions: true } } },
    });

    const completions = await this.completionsIn(params.workspaceId, start, end);

    const items: AgendaItem[] = [];

    for (const block of scheduled) {
      const schedule = block.schedule;
      if (!schedule) continue;

      const props = (block.properties ?? {}) as Record<string, unknown>;
      const occurrences = occurrencesIn(schedule, schedule.exceptions, start, end);

      for (const occ of occurrences) {
        items.push({
          blockId: block.id,
          type: block.type,
          title: (props.text as string) || (props.name as string) || 'Sin título',
          occurrenceAt: occ.at.toISOString(),
          effectiveAt: occ.effectiveAt.toISOString(),
          moved: occ.moved,
          // An action deferred to "this week" carries a range wider than a day.
          // It is due at some point inside the period, not at a moment in it.
          spansPeriod: Boolean(
            schedule.endDate && !dayjs(schedule.startDate).isSame(schedule.endDate, 'day'),
          ),
          recurring: Boolean(schedule.rrule),
          done: completions.has(completionKey(block.id, occ.at)),
          sortOrder: (props.sortOrder as number) ?? 0,
          estimateMinutes: (props.estimateMinutes as number) ?? null,
          priority: (props.priority as string) ?? null,
        });
      }
    }

    items.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime(),
    );

    const plannedMinutes = items
      .filter((i) => !i.done)
      .reduce((total, i) => total + (i.estimateMinutes ?? 0), 0);

    return {
      period: params.period,
      label,
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: tz,
      items,
      // What is left to do in the period, so a caller can say the period is
      // overloaded without summing it again.
      plannedMinutes,
      unestimatedCount: items.filter((i) => !i.done && i.estimateMinutes == null).length,
    };
  }

  /**
   * Which occurrences in the window are currently done.
   *
   * Derived from the event log rather than stored on the block: a habit has no
   * single completion date, and a block only ever holds one state. Reopening
   * writes another event, so the last event for an occurrence wins.
   */
  private async completionsIn(workspaceId: string, start: Date, end: Date): Promise<Set<string>> {
    const events = await this.prisma.event.findMany({
      where: {
        workspaceId,
        type: { in: ['occurrence.completed', 'occurrence.reopened'] },
      },
      orderBy: { createdAt: 'asc' },
      select: { type: true, blockId: true, metadata: true },
    });

    const done = new Set<string>();

    for (const ev of events) {
      const at = (ev.metadata as Record<string, unknown> | null)?.occurrenceAt as string | undefined;
      if (!at) continue;
      const when = new Date(at);
      if (when < start || when > end) continue;

      const key = completionKey(ev.blockId, when);
      if (ev.type === 'occurrence.completed') done.add(key);
      else done.delete(key);
    }

    return done;
  }

  /**
   * Ticks or unticks one occurrence.
   *
   * Recorded against the instant the rule predicted, not against the moment of
   * ticking — otherwise catching up on yesterday's habit would mark it done
   * today, and the streak would describe the wrong days.
   */
  async setCompletion(params: {
    userId: string;
    blockId: string;
    occurrenceAt: string;
    done: boolean;
  }) {
    const block = await this.blocks.assertBlockAccess(params.userId, params.blockId);

    const schedule = await this.prisma.schedule.findUnique({
      where: { blockId: params.blockId },
    });
    if (!schedule) throw new NotFoundException(`Block ${params.blockId} has no schedule`);

    await this.events.record(
      params.done ? 'occurrence.completed' : 'occurrence.reopened',
      block,
      { occurrenceAt: new Date(params.occurrenceAt).toISOString() },
      params.userId,
    );

    // A one-off action has exactly one occurrence, so its state is also the
    // block's state and the rest of the app reads it there. A recurring one has
    // no such thing — a habit is never "done" — so its block is left alone.
    if (!schedule.rrule) {
      await this.blocks.update(params.userId, params.blockId, {
        properties: { status: params.done ? 'done' : 'todo' },
      });
    }

    return { success: true };
  }

  /**
   * Reorders the agenda by rewriting sortOrder across the blocks given.
   *
   * The order is a property of the block rather than of the occurrence: dragging
   * a habit above a task means it comes first every day, not only today.
   */
  async reorder(params: { userId: string; workspaceId: string; blockIds: string[] }) {
    await this.blocks.assertWorkspaceMembership(params.userId, params.workspaceId);

    const blocks = await this.prisma.block.findMany({
      where: { id: { in: params.blockIds }, workspaceId: params.workspaceId, deletedAt: null },
      select: { id: true, properties: true },
    });

    const known = new Map(blocks.map((b) => [b.id, b.properties]));

    await this.prisma.$transaction(
      params.blockIds
        .filter((id) => known.has(id))
        .map((id, index) =>
          this.prisma.block.update({
            where: { id },
            data: {
              properties: {
                ...((known.get(id) ?? {}) as Record<string, unknown>),
                sortOrder: index,
              },
            },
          }),
        ),
    );

    return { success: true, reordered: blocks.length };
  }
}

function completionKey(blockId: string, at: Date): string {
  return `${blockId}@${at.toISOString()}`;
}
