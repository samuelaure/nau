import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { ScopedPrismaService } from '../core/tenancy/scoped-prisma.service';
import { BlockEventsService } from '../blocks/block-events.service';
import {
  dayIn,
  gregorian,
  gregorianOverdueRatio,
  gregorianPeriodAt,
  overlaps,
  visibleIn,
  type Interval,
  type Occurrence,
  type ResolveContext,
} from '@nau/time';
import { WorkspaceTimeService } from '../time/workspace-time.service';
import { OccurrencesService, type OccurrenceRef } from '../time/occurrences.service';

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
  /**
   * The calendar day this row belongs to, in the workspace's own zone.
   *
   * Computed here rather than left to the client: an instant only becomes a day
   * once you know where it is being lived, and slicing an ISO string answers for
   * UTC. In Madrid that moves the boundary by an hour and files two hours of
   * every day under the one before.
   */
  day: string;
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
    private readonly tenancy: ScopedPrismaService,
    private readonly events: BlockEventsService,
    private readonly time: WorkspaceTimeService,
    private readonly occurrences: OccurrencesService,
  ) {}

  async forPeriod(params: {
    userId: string;
    workspaceId: string;
    scale: string;
    system?: string;
    /** Any date inside the period being asked about. */
    date: string;
    now?: Date;
  }) {
    await this.tenancy.assertMembership(params.userId, params.workspaceId);

    const now = params.now ?? new Date();
    const system = params.system ?? gregorian.id;
    const ctx = await this.time.resolveContext(params.workspaceId, system, now);
    const ref = dayIn(params.date, ctx.timezone).toDate();

    const period = gregorianPeriodAt(params.scale, ref, ctx);
    if (!period) {
      return {
        ...this.summarise([]),
        scale: params.scale,
        label: '',
        start: ref.toISOString(),
        end: ref.toISOString(),
        timezone: ctx.timezone,
      };
    }

    // Only the period being lived carries anything forward: looking back at
    // last Tuesday should show last Tuesday, not last Tuesday plus everything
    // still open.
    const isCurrent =
      now >= period.interval.start && (!period.interval.end || now < period.interval.end);

    const items = await this.collect({
      workspaceId: params.workspaceId,
      range: period.interval,
      scale: params.scale,
      system,
      now,
      carry: isCurrent ? { scale: params.scale, from: period.interval.start } : undefined,
      ctx,
    });

    return {
      ...this.summarise(items),
      scale: params.scale,
      label: period.name,
      start: period.interval.start.toISOString(),
      end: period.interval.end?.toISOString() ?? null,
      timezone: ctx.timezone,
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
    /** The scale the view is showing, which is what carry-over matches. */
    scale?: string;
    system?: string;
    now?: Date;
  }) {
    await this.tenancy.assertMembership(params.userId, params.workspaceId);

    const now = params.now ?? new Date();
    const system = params.system ?? gregorian.id;
    const scale = params.scale ?? 'day';
    const ctx = await this.time.resolveContext(params.workspaceId, system, now);

    const start = dayIn(params.from, ctx.timezone).startOf('day').toDate();
    const end = dayIn(params.to, ctx.timezone).endOf('day').toDate();
    const range: Interval = { start, end };

    const current = gregorianPeriodAt(scale, now, ctx);
    const currentInRange =
      current !== null && overlaps(current.interval, range);

    const items = await this.collect({
      workspaceId: params.workspaceId,
      range,
      scale,
      system,
      now,
      carry:
        currentInRange && current
          ? { scale, from: current.interval.start }
          : undefined,
      ctx,
    });

    return {
      ...this.summarise(items),
      scale,
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: ctx.timezone,
    };
  }

  /**
   * Everything with no schedule at all: GTD's next actions.
   *
   * Not a defect and not a leftover. An action with no period is one nobody has
   * decided when to do, which is exactly where a capture should wait — and it is
   * why triage deliberately creates without one. Capturing is not planning.
   *
   * Returned separately from any period because it belongs to none: putting it
   * under today would be deciding on the person's behalf, which is the decision
   * this list exists to leave open.
   */
  async nextActions(params: { userId: string; workspaceId: string }) {
    await this.tenancy.assertMembership(params.userId, params.workspaceId);

    const blocks = await this.prisma.block.findMany({
      where: {
        workspaceId: params.workspaceId,
        deletedAt: null,
        type: { in: AGENDA_TYPES },
        planning: { is: null },
        AND: [{ properties: { path: ['status'], not: 'done' } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: blocks.map((block) => {
        const props = (block.properties ?? {}) as Record<string, unknown>;
        return {
          blockId: block.id,
          type: block.type,
          title: (props.text as string) || (props.name as string) || 'Sin título',
          parentId: block.parentId,
          sortOrder: (props.sortOrder as number) ?? 0,
          estimateMinutes: (props.estimateMinutes as number) ?? null,
          priority: (props.priority as string) ?? null,
          createdAt: block.createdAt.toISOString(),
        };
      }),
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
    range: Interval;
    scale: string;
    system: string;
    now: Date;
    /** When set, overdue one-offs of this scale land at `from`. */
    carry?: { scale: string; from: Date };
    ctx: ResolveContext;
  }): Promise<AgendaItem[]> {
    const { workspaceId, range, scale, system, now, carry, ctx } = params;

    const history = await this.historyFor(workspaceId);

    // Time answers when things occur; this service decides what they mean.
    const occurrences = await this.occurrences.inView({
      workspaceId,
      range,
      scale,
      system,
      now,
      lastCompleted: history.lastCompletion,
    });

    // Only the blocks Time reported, and only those that belong on an agenda.
    // The type filter is Actions' business, which is why it is applied here and
    // not inside Time.
    const blockIds = [...new Set(occurrences.map((o) => o.blockId))];
    const blocks = await this.prisma.block.findMany({
      where: { id: { in: blockIds }, type: { in: AGENDA_TYPES }, deletedAt: null },
      include: { planning: true },
    });
    const byId = new Map(blocks.map((b) => [b.id, b]));

    const items: AgendaItem[] = [];
    const seen = new Set<string>();

    for (const occurrence of occurrences) {
      const block = byId.get(occurrence.blockId);
      if (!block) continue;

      const props = (block.properties ?? {}) as Record<string, unknown>;
      seen.add(block.id);

      items.push(
        this.toItem({
          block,
          props,
          occurrence,
          shownAt: occurrence.effectiveAt,
          ctx,
          history,
        }),
      );
    }

    // A one-off never completed keeps showing up: in the period being lived now
    // as well as in the one it was planned for. Derived rather than written, so
    // no cron can drift and the counters fall out of arithmetic and the event
    // log rather than out of a column somebody maintains.
    if (carry) {
      for (const carried of await this.carriedInto(workspaceId, carry, seen, history, ctx)) {
        items.push(carried);
      }
    }

    items.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime(),
    );

    return items;
  }

  /** One agenda row, from an occurrence plus what its block means. */
  private toItem(params: {
    block: { id: string; type: string; parentId: string | null };
    props: Record<string, unknown>;
    occurrence: OccurrenceRef;
    shownAt: Date;
    ctx: ResolveContext;
    history: History;
    carriedFrom?: Date;
    carriedPeriods?: number;
  }): AgendaItem {
    const { block, props, occurrence, shownAt, ctx, history } = params;
    const day = gregorianPeriodAt('day', shownAt, ctx);

    return {
      blockId: block.id,
      type: block.type,
      title: (props['text'] as string) || (props['name'] as string) || 'Sin título',
      occurrenceAt: occurrence.occurrenceAt.toISOString(),
      effectiveAt: occurrence.effectiveAt.toISOString(),
      shownAt: shownAt.toISOString(),
      day: (day?.interval.start ?? shownAt).toISOString().slice(0, 10),
      moved: occurrence.moved,
      spansPeriod: occurrence.scale !== 'day',
      recurring: occurrence.recurring,
      // "Habit" is not a stored type. Anything with a recurrence is one, so
      // adding a frequency turns an action into a habit and removing it turns
      // it back, with no write and no second transition to maintain.
      isHabit: occurrence.recurring,
      projected: occurrence.projected,
      done: history.done.has(completionKey(block.id, occurrence.occurrenceAt)),
      sortOrder: (props['sortOrder'] as number) ?? 0,
      estimateMinutes: (props['estimateMinutes'] as number) ?? null,
      priority: (props['priority'] as string) ?? null,
      parentId: block.parentId,
      carriedFrom: params.carriedFrom?.toISOString() ?? null,
      carriedPeriods: params.carriedPeriods ?? 0,
      rescheduledCount: history.rescheduled.get(block.id) ?? 0,
      overdue: occurrence.overdue,
    };
  }

  /**
   * Overdue one-offs, drawn under the period being lived now.
   *
   * Only those planned at this scale: an action deferred to a month belongs in
   * the month view, and putting it in today's list would defeat the point of
   * having deferred it.
   */
  private async carriedInto(
    workspaceId: string,
    carry: { scale: string; from: Date },
    alreadyShown: ReadonlySet<string>,
    history: History,
    ctx: ResolveContext,
  ): Promise<AgendaItem[]> {
    const overdue = await this.prisma.block.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        type: { in: AGENDA_TYPES },
        id: { notIn: [...alreadyShown] },
        planning: {
          is: { scale: carry.scale, recurrence: null, to: { lte: carry.from } },
        },
      },
      include: { planning: true },
    });

    const out: AgendaItem[] = [];

    for (const block of overdue) {
      const planning = block.planning;
      if (!planning) continue;
      if (history.done.has(completionKey(block.id, planning.anchor))) continue;

      const periods = this.periodsBetween(carry.scale, planning.from, carry.from, ctx);

      out.push(
        this.toItem({
          block,
          props: (block.properties ?? {}) as Record<string, unknown>,
          occurrence: {
            blockId: block.id,
            occurrenceAt: planning.anchor,
            effectiveAt: planning.anchor,
            moved: false,
            projected: false,
            system: planning.system,
            scale: planning.scale,
            from: planning.from,
            to: planning.to,
            recurring: false,
            overdue: 0,
          },
          // Shown under the period being lived now while staying recorded
          // against the day it was planned for, so it can be ticked from either.
          shownAt: carry.from,
          ctx,
          history,
          carriedFrom: planning.anchor,
          carriedPeriods: periods,
        }),
      );
    }

    return out;
  }

  /**
   * How many whole periods of a scale separate two instants.
   *
   * Counted by walking the calendar rather than dividing by a nominal length,
   * so it stays right across months of different lengths and DST changes.
   */
  private periodsBetween(scale: string, from: Date, to: Date, ctx: ResolveContext): number {
    let count = 0;
    let cursor = gregorianPeriodAt(scale, from, ctx);

    while (cursor && cursor.interval.end && cursor.interval.end <= to && count < 512) {
      count += 1;
      cursor = gregorianPeriodAt(scale, cursor.interval.end, ctx);
    }

    return count;
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
    const block = await this.tenancy.assertBlockAccess(params.userId, params.blockId);

    const planning = await this.prisma.planning.findUnique({
      where: { blockId: params.blockId },
    });
    if (!planning) throw new NotFoundException(`Block ${params.blockId} is not planned`);

    await this.events.record(
      params.done ? 'occurrence.completed' : 'occurrence.reopened',
      block,
      { occurrenceAt: new Date(params.occurrenceAt).toISOString() },
      params.userId,
    );

    // A one-off action has exactly one occurrence, so its state is also the
    // block's state and the rest of the app reads it there. A recurring one has
    // no such thing — a habit is never "done" — so its block is left alone.
    if (!planning.recurrence) {
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
    await this.tenancy.assertMembership(params.userId, params.workspaceId);

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
