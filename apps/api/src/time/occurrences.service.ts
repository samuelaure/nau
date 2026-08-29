import { Injectable } from '@nestjs/common';
import {
  gregorian,
  gregorianOverdueRatio,
  visibleIn,
  type Interval,
  type Occurrence,
  type ResolveContext,
  type SystemId,
} from '@nau/time';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceTimeService } from './workspace-time.service';

/**
 * When planned things occur, across a stretch of time.
 *
 * The half of the old agenda that was actually about time. What a block *is* —
 * an action, a habit, an appointment — and whether it is done are questions for
 * whoever owns the block; this service never reads `properties` and never sees
 * a block type.
 *
 * Items planned in any system are returned together, each carrying the system
 * it was planned in, so a view can merge them into one list or split them into
 * per-system lanes without asking for the data twice.
 */

export interface OccurrenceRef {
  readonly blockId: string;
  /** The instant the rule predicted. The key completion is recorded against. */
  readonly occurrenceAt: Date;
  /** Where it actually falls. Differs only when the occurrence was moved. */
  readonly effectiveAt: Date;
  readonly moved: boolean;
  /** An estimate rather than a commitment. See Occurrence.projected. */
  readonly projected: boolean;
  /** Preserved through translation so a view can group or filter by it. */
  readonly system: SystemId;
  readonly scale: string;
  /** The span the block occupies, as its own system resolved it. */
  readonly from: Date;
  readonly to: Date;
  readonly recurring: boolean;
  /** How far past due, as a multiple of the rule's own turn. 0 is on time. */
  readonly overdue: number;
}

export interface ViewQuery {
  readonly workspaceId: string;
  readonly range: Interval;
  /** The scale being displayed, which decides what is comparable to it. */
  readonly scale: string;
  readonly system?: SystemId;
  readonly now?: Date;
  /** Systems the viewer has hidden. A filter, never a capability. */
  readonly hiddenSystems?: readonly SystemId[];
  /** Latest completion per block, for rules that count from it. */
  readonly lastCompleted?: ReadonlyMap<string, Date>;
}

@Injectable()
export class OccurrencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly time: WorkspaceTimeService,
  ) {}

  /**
   * Everything owed inside a view.
   *
   * Two independent tests decide what appears, each doing its own job: whether
   * the block overlaps the stretch being viewed, and whether it was placed at a
   * scale comparable to this view's. The second is what keeps a task spanning
   * all of August out of each of August's thirty-one day views — without
   * needing to know that it is a task.
   */
  async inView(query: ViewQuery): Promise<readonly OccurrenceRef[]> {
    const now = query.now ?? new Date();
    const viewSystem = query.system ?? gregorian.id;

    const scale = this.time.registry_().scale(viewSystem, query.scale);
    if (!scale) return [];

    const { start, end } = query.range;
    if (!end) return [];

    // Anything whose span touches the window. The scale comparison happens in
    // memory, since it is a property of the scale rather than of a row.
    const plannings = await this.prisma.planning.findMany({
      where: {
        block: { workspaceId: query.workspaceId, deletedAt: null },
        from: { lt: end },
        to: { gt: start },
      },
      include: { overrides: true },
    });

    const hidden = new Set(query.hiddenSystems ?? []);
    const contexts = new Map<SystemId, ResolveContext>();
    const out: OccurrenceRef[] = [];

    for (const planning of plannings) {
      if (hidden.has(planning.system)) continue;

      const span: Interval = { start: planning.from, end: planning.to };
      const recurring = Boolean(planning.recurrence);

      // A one-off is shown where it was placed. A recurring one is governed by
      // its rule rather than by a span, so the size test does not apply to it.
      if (!recurring && !visibleIn(span, query.range, scale.typicalMs)) continue;

      let ctx = contexts.get(planning.system);
      if (!ctx) {
        ctx = await this.time.resolveContext(query.workspaceId, planning.system, start);
        contexts.set(planning.system, ctx);
      }

      const occurrences = recurring
        ? this.expand(planning, query.range, ctx, query.lastCompleted?.get(planning.blockId))
        : this.singleOccurrence(planning);

      for (const occurrence of occurrences) {
        out.push({
          blockId: planning.blockId,
          occurrenceAt: occurrence.at,
          effectiveAt: occurrence.effectiveAt,
          moved: occurrence.moved,
          projected: occurrence.projected,
          system: planning.system,
          scale: planning.scale,
          from: planning.from,
          to: planning.to,
          recurring,
          overdue:
            planning.recurrenceMode === 'AFTER_COMPLETION' && planning.recurrence
              ? gregorianOverdueRatio(
                  {
                    system: planning.system,
                    expression: planning.recurrence,
                    timezone: planning.recurrenceTimezone,
                  },
                  occurrence.effectiveAt,
                  now,
                  query.lastCompleted?.get(planning.blockId) ?? planning.anchor,
                )
              : 0,
        });
      }
    }

    return out.sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime());
  }

  /**
   * The one occurrence of a block that does not repeat.
   *
   * Overrides apply here exactly as they do to a rule. Skipping a one-off is a
   * decision like any other, and reading `anchor` straight would make a skipped
   * item reappear for ever and a moved one draw on the date it was moved from.
   */
  private singleOccurrence(planning: {
    anchor: Date;
    overrides: { occurrenceAt: Date; kind: string; movedTo: Date | null }[];
  }): readonly Occurrence[] {
    const override = planning.overrides.find(
      (o) => o.occurrenceAt.getTime() === planning.anchor.getTime(),
    );

    if (override?.kind === 'SKIPPED') return [];

    const movedTo = override?.kind === 'MOVED' ? override.movedTo : null;

    return [
      {
        at: planning.anchor,
        effectiveAt: movedTo ?? planning.anchor,
        moved: Boolean(movedTo),
        projected: false,
      },
    ];
  }

  private expand(
    planning: {
      system: string;
      anchor: Date;
      recurrence: string | null;
      recurrenceTimezone: string | null;
      recurrenceMode: string;
      recurrenceUntil: Date | null;
      overrides: { occurrenceAt: Date; kind: string; movedTo: Date | null }[];
    },
    range: Interval,
    ctx: ResolveContext,
    lastCompletedAt: Date | undefined,
  ): readonly Occurrence[] {
    const system = this.time.registry_().find(planning.system);
    if (!system || !planning.recurrence) return [];

    return system.occurrences(
      {
        system: planning.system,
        expression: planning.recurrence,
        timezone: planning.recurrenceTimezone,
      },
      range,
      {
        ...ctx,
        startAt: planning.anchor,
        overrides: planning.overrides.map((o) => ({
          occurrenceAt: o.occurrenceAt,
          kind: o.kind as 'SKIPPED' | 'MOVED',
          movedTo: o.movedTo,
        })),
        ...(lastCompletedAt ? { lastCompletedAt } : {}),
        ...(planning.recurrenceUntil ? { endAt: planning.recurrenceUntil } : {}),
        mode: planning.recurrenceMode,
      } as never,
    );
  }
}
