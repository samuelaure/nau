import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { BlockEventsService } from '../blocks/block-events.service';
import { occurrencesIn, intervalMsOf, overdueRatio } from '../schedule/occurrences';
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
  /**
   * The period this row is drawn under. Equals `effectiveAt` except for a carried
   * item, which is shown today while still recorded against the day it was
   * planned for — so it can be ticked from either.
   */
  shownAt: string;
  /** True when the schedule spans more than the day: due *within* the period. */
  spansPeriod: boolean;
  recurring: boolean;
  /** A habit is anything with a recurrence. The type is derived, never stored. */
  isHabit: boolean;
  /** An estimate rather than a commitment. Only anchored schedules produce these. */
  projected: boolean;
  done: boolean;
  sortOrder: number;
  estimateMinutes: number | null;
  priority: string | null;
  /** Where it hangs in the tree. Null for a root item of its day. */
  parentId: string | null;
  /**
   * Set when the item is being shown outside the period it was planned for.
   * Carries the original date so the person can go back and tick it there.
   */
  carriedFrom: string | null;
  /** Periods elapsed since it was planned. Derived, never written. */
  carriedPeriods: number;
  /** Times the person moved it by hand. Counted from the event log. */
  rescheduledCount: number;
  /**
   * How far past due, as a multiple of the schedule's own interval. 0 is on
   * time, 1 is a whole interval late. The interface maps it onto colour.
   */
  overdue: number;
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
    now?: Date;
  }) {
    await this.blocks.assertWorkspaceMembership(params.userId, params.workspaceId);

    const now = params.now ?? new Date();
    const tz = await this.workspaceTimezone(params.workspaceId);
    const ref = dayIn(params.date, tz).toDate();
    const { start, end, label } = periodBounds(params.period, tz, ref);

    // Whether the period being viewed is the one currently being lived. Only the
    // current period carries anything forward: looking back at last Tuesday
    // should show last Tuesday, not last Tuesday plus everything still open.
    const isCurrent = now >= start && now <= end;

    const items = await this.collect({
      workspaceId: params.workspaceId,
      tz,
      start,
      end,
      now,
      carry: isCurrent ? { period: params.period, from: start } : undefined,
    });

    return {
      ...this.summarise(items),
      period: params.period,
      label,
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: tz,
    };
  }

  /**
   * Occurrences across an arbitrary span, for a view showing many periods at once.
   *
   * Home lists a run of days rather than one, so asking period by period would be
   * one request per day on screen. Every item carries its own occurrence instant,
   * so grouping them back into days is arithmetic on the client.
   *
   * Carry-over still lands only on the period being lived now, never on every day
   * in the span: an unfinished task belongs to today and to the day it was
   * planned for, and nowhere in between.
   */
  async forRange(params: {
    userId: string;
    workspaceId: string;
    from: string;
    to: string;
    /** Granularity the view is showing, which is what carry-over matches. */
    period?: PeriodType;
    now?: Date;
  }) {
    await this.blocks.assertWorkspaceMembership(params.userId, params.workspaceId);

    const now = params.now ?? new Date();
    const tz = await this.workspaceTimezone(params.workspaceId);
    const period = params.period ?? 'daily';

    const start = dayIn(params.from, tz).startOf('day').toDate();
    const end = dayIn(params.to, tz).endOf('day').toDate();

    const current = periodBounds(period, tz, now);
    const currentInRange = current.start >= start && current.start <= end;

    const items = await this.collect({
      workspaceId: params.workspaceId,
      tz,
      start,
      end,
      now,
      carry: currentInRange ? { period, from: current.start } : undefined,
    });

    return {
      ...this.summarise(items),
      period,
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: tz,
    };
  }

  /** The counts a view shows above the list, computed once. */
  private summarise(items: AgendaItem[]) {
    return {
      items,
      plannedMinutes: items
        .filter((i) => !i.done && !i.projected)
        .reduce((total, i) => total + (i.estimateMinutes ?? 0), 0),
      unestimatedCount: items.filter((i) => !i.done && !i.projected && i.estimateMinutes == null)
        .length,
      carriedCount: items.filter((i) => i.carriedFrom).length,
    };
  }

  /**
   * Expands every scheduled block in the workspace across a window.
   *
   * Shared by both entry points, so a day rendered inside a run of days and the
   * same day rendered on its own can never disagree.
   */
  private async collect(params: {
    workspaceId: string;
    tz: string;
    start: Date;
    end: Date;
    now: Date;
    /** When set, overdue one-offs of this granularity land at `from`. */
    carry?: { period: PeriodType; from: Date };
  }): Promise<AgendaItem[]> {
    const { workspaceId, tz, start, end, now, carry } = params;

    const scheduled = await this.prisma.block.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        type: { in: AGENDA_TYPES },
        schedule: { is: { startDate: { lte: end } } },
      },
      include: { schedule: { include: { exceptions: true } } },
    });

    const history = await this.historyFor(workspaceId);

    const items: AgendaItem[] = [];

    for (const block of scheduled) {
      const schedule = block.schedule;
      if (!schedule) continue;

      const props = (block.properties ?? {}) as Record<string, unknown>;
      const recurring = Boolean(schedule.rrule);
      const anchored = schedule.recurrenceMode === 'AFTER_COMPLETION';
      const lastDone = history.lastCompletion.get(block.id) ?? null;

      const occurrences = occurrencesIn(
        schedule,
        schedule.exceptions,
        start,
        end,
        lastDone,
      );

      // A one-off action that was never completed keeps showing up, in the
      // period being lived now as well as in the one it was planned for. It is
      // derived rather than written: no cron moves anything, so nothing can
      // drift if a night fails, and the two counters fall out of arithmetic and
      // the event log rather than out of a column somebody has to maintain.
      const carried =
        carry && !recurring && occurrences.length === 0
          ? this.carriedOccurrence(schedule, carry.period, tz, carry.from, history, block.id)
          : null;

      const all = carried ? [...occurrences, carried.occurrence] : occurrences;
      const interval = anchored ? intervalMsOf(schedule, lastDone ?? schedule.startDate) : null;

      for (const occ of all) {
        const isCarried = carried?.occurrence === occ;
        items.push({
          blockId: block.id,
          type: block.type,
          title: (props.text as string) || (props.name as string) || 'Sin título',
          occurrenceAt: occ.at.toISOString(),
          effectiveAt: occ.effectiveAt.toISOString(),
          // Where the row is drawn. A carried item appears under the period being
          // lived now while staying recorded against the day it was planned for,
          // which is what lets it be ticked from either.
          shownAt: (isCarried ? carry!.from : occ.effectiveAt).toISOString(),
          moved: occ.moved,
          spansPeriod: Boolean(
            schedule.endDate && !dayjs(schedule.startDate).isSame(schedule.endDate, 'day'),
          ),
          recurring,
          // "Habit" is not a stored type. Anything with a recurrence is one, so
          // adding a frequency turns an action into a habit and removing it
          // turns it back, with no write and no second transition to maintain.
          isHabit: recurring,
          projected: occ.projected,
          done: history.done.has(completionKey(block.id, occ.at)),
          sortOrder: (props.sortOrder as number) ?? 0,
          estimateMinutes: (props.estimateMinutes as number) ?? null,
          priority: (props.priority as string) ?? null,
          parentId: block.parentId,
          carriedFrom: isCarried ? carried!.originalAt.toISOString() : null,
          carriedPeriods: isCarried ? carried!.periods : 0,
          rescheduledCount: history.rescheduled.get(block.id) ?? 0,
          overdue: anchored ? overdueRatio(occ.effectiveAt, interval, now) : 0,
        });
      }
    }

    items.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime(),
    );

    return items;
  }

  /**
   * The single occurrence of an overdue one-off, carried into the period being
   * lived now.
   *
   * Only when the thing was planned at this granularity: an action deferred to a
   * month belongs in the month view, and putting it in today's list would defeat
   * the point of having deferred it.
   */
  private carriedOccurrence(
    schedule: { startDate: Date; endDate: Date | null },
    period: PeriodType,
    tz: string,
    windowStart: Date,
    history: History,
    blockId: string,
  ) {
    const originalAt = schedule.startDate;
    if (originalAt >= windowStart) return null;
    if (granularityOf(schedule) !== period) return null;
    if (history.done.has(completionKey(blockId, originalAt))) return null;

    const originalBounds = periodBounds(period, tz, originalAt);
    const periods = countPeriodsBetween(period, tz, originalBounds.start, windowStart);

    return {
      occurrence: {
        at: originalAt,
        effectiveAt: originalAt,
        moved: false,
        projected: false,
      },
      originalAt,
      periods,
    };
  }

  /**
   * Everything the event log knows about these blocks.
   *
   * Read once for the whole agenda rather than per block: a day has a handful of
   * items but a week of a busy month has dozens, and this is the query that
   * would otherwise run once each.
   */
  private async historyFor(workspaceId: string): Promise<History> {
    const events = await this.prisma.event.findMany({
      where: {
        workspaceId,
        type: {
          in: ['occurrence.completed', 'occurrence.reopened', 'block.rescheduled'],
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { type: true, blockId: true, metadata: true },
    });

    const done = new Set<string>();
    const lastCompletion = new Map<string, Date>();
    const rescheduled = new Map<string, number>();

    for (const ev of events) {
      if (ev.type === 'block.rescheduled') {
        rescheduled.set(ev.blockId, (rescheduled.get(ev.blockId) ?? 0) + 1);
        continue;
      }

      const at = (ev.metadata as Record<string, unknown> | null)?.occurrenceAt as string | undefined;
      if (!at) continue;
      const when = new Date(at);
      const key = completionKey(ev.blockId, when);

      if (ev.type === 'occurrence.completed') {
        done.add(key);
        const previous = lastCompletion.get(ev.blockId);
        if (!previous || when > previous) lastCompletion.set(ev.blockId, when);
      } else {
        done.delete(key);
        // Reopening the latest completion moves the anchor back. Recomputing it
        // exactly would need the full history; taking the reopened instant out
        // is enough, because a reopened occurrence is due again.
        const previous = lastCompletion.get(ev.blockId);
        if (previous && previous.getTime() === when.getTime()) {
          lastCompletion.delete(ev.blockId);
        }
      }
    }

    return { done, lastCompletion, rescheduled };
  }

  /**
   * Ticks or unticks one occurrence.
   *
   * Recorded against the instant the rule predicted, never the moment of
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

interface History {
  done: Set<string>;
  lastCompletion: Map<string, Date>;
  rescheduled: Map<string, number>;
}

function completionKey(blockId: string, at: Date): string {
  return `${blockId}@${at.toISOString()}`;
}

/**
 * The granularity something was planned at, read off the span of its schedule.
 *
 * Derived rather than stored, so that widening a range is the only thing anyone
 * has to do to defer an action from a day to a week.
 */
function granularityOf(schedule: { startDate: Date; endDate: Date | null }): PeriodType {
  const end = schedule.endDate ?? schedule.startDate;
  const days = dayjs(end).diff(dayjs(schedule.startDate), 'day') + 1;
  if (days <= 1) return 'daily';
  if (days <= 8) return 'weekly';
  if (days <= 32) return 'monthly';
  if (days <= 95) return 'trimester';
  return 'yearly';
}

/** How many whole periods separate two instants, in the workspace's zone. */
function countPeriodsBetween(period: PeriodType, tz: string, from: Date, to: Date): number {
  const unit =
    period === 'daily'
      ? 'day'
      : period === 'weekly'
        ? 'week'
        : period === 'monthly'
          ? 'month'
          : period === 'trimester'
            ? 'month'
            : 'year';
  const raw = dayjs(to).tz(safeZone(tz)).diff(dayjs(from).tz(safeZone(tz)), unit);
  return period === 'trimester' ? Math.floor(raw / 3) : raw;
}
