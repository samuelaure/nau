import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  fitsDirectRead,
  gregorian,
  gregorianClosedPeriodAt,
  gregorianPeriodsIn,
  gregorianJournal,
  localNow,
  type Period,
  type ResolveContext,
  type SourcePlan,
} from '@nau/time';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceTimeService } from './workspace-time.service';
import { JournalService } from '../journal/journal.service';

/**
 * Deciding when a period has closed, and asking Journal to interpret it.
 *
 * This lives in Time because both halves are calendar questions: which period
 * just ended in this workspace's own zone, and which entries or smaller
 * syntheses compose it. Journal receives resolved ids and nothing else — if it
 * queried by date it would be re-deriving what a period is, which is the
 * coupling the split exists to remove.
 *
 * It replaces the cron that lived in `journal.service.ts` until Journal was
 * extracted (commit 4d068515). That removal was correct and planned, but it
 * left the platform with no trigger at all: scheduled syntheses stopped
 * happening silently, because nothing was failing — nothing was being
 * attempted. See nau#45.
 */

/** Which Gregorian scales are generated automatically, and at what local hour. */
const GREGORIAN_RUNS: readonly { scale: string; hour: number }[] = [
  // Just after local midnight, the day that ended is closed and safe to read.
  { scale: 'day', hour: 0 },
  // Staggered so each level reads what the one below has already written.
  { scale: 'week', hour: 1 },
  { scale: 'month', hour: 2 },
  { scale: 'quarter', hour: 3 },
  { scale: 'year', hour: 4 },
];

@Injectable()
export class SynthesisSchedulerService {
  private readonly logger = new Logger(SynthesisSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly time: WorkspaceTimeService,
    private readonly journal: JournalService,
  ) {}

  /**
   * Hourly tick. Every workspace is checked in its own local time.
   *
   * Hourly rather than daily because "midnight" is a different instant for each
   * workspace, and a single daily run would be midnight for at most one of them.
   */
  @Cron('0 * * * *')
  async tick(now: Date = new Date()): Promise<void> {
    const workspaces = await this.prisma.workspace.findMany({ select: { id: true } });

    for (const workspace of workspaces) {
      try {
        await this.runWorkspace(workspace.id, now);
      } catch (err) {
        // One workspace's failure must not stop the tick for the rest.
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Synthesis tick failed for workspace ${workspace.id}: ${message}`);
      }
    }
  }

  private async runWorkspace(workspaceId: string, now: Date): Promise<void> {
    const ctx = await this.time.resolveContext(workspaceId, gregorian.id, now);
    const local = localNow(ctx.timezone, now);

    for (const run of GREGORIAN_RUNS) {
      if (local.hour() !== run.hour) continue;

      const closed = gregorianClosedPeriodAt(run.scale, now, ctx);
      if (!closed) continue;

      // Only when the period genuinely closed in the last hour. Without this a
      // daily run at 02:00 would regenerate January's synthesis every day of
      // February, because January is always the "closed month" until March.
      if (!this.justClosed(closed, now, run.scale, ctx)) continue;

      await this.synthesise(workspaceId, closed, ctx);
    }
  }

  /**
   * Whether this period ended within the hour now beginning.
   *
   * The check that makes an hourly tick idempotent: a period is synthesised on
   * the one tick that follows its end, and never again.
   */
  private justClosed(period: Period, now: Date, scale: string, _ctx: ResolveContext): boolean {
    const end = period.interval.end;
    if (!end) return false;
    const sinceEnd = now.getTime() - end.getTime();
    // The tick fires on the hour, and the period ends on a local boundary, so
    // the gap is the configured offset. One hour of tolerance covers a late tick
    // without ever spanning two.
    const offsetMs = (GREGORIAN_RUNS.find((r) => r.scale === scale)?.hour ?? 0) * 3_600_000;
    return sinceEnd >= offsetMs && sinceEnd < offsetMs + 3_600_000;
  }

  /**
   * Builds one period's synthesis, if it is worth building.
   *
   * Time chooses the sources; Journal interprets them. The choice is made on
   * actual content density rather than on the nominal length of the period,
   * because a quiet month can hold less than a busy week and should be read
   * straight from the entries.
   */
  async synthesise(
    workspaceId: string,
    period: Period,
    ctx: ResolveContext,
  ): Promise<{ generated: boolean; reason?: string }> {
    const plans = gregorianJournal.preferredSources(period, ctx);

    for (const plan of plans) {
      const ids = await this.resolveSourceIds(workspaceId, plan);
      if (ids.length === 0) continue;

      const density = await this.densityOf(workspaceId, plan, ids);

      // Reading the entries directly is preferred and truthful; falling to the
      // level below trades one layer of compression for a bounded size. Take
      // the first plan that fits, and the last one regardless — a period whose
      // smaller syntheses are themselves large still has to be summarised.
      const isLast = plan === plans[plans.length - 1];
      if (!fitsDirectRead(density) && !isLast) continue;

      if (gregorianJournal.shouldSynthesise?.(period, density) === false) {
        return { generated: false, reason: 'empty' };
      }

      await this.journal.generateSynthesis({
        workspaceId,
        from: period.interval.start.toISOString(),
        to: (period.interval.end ?? period.interval.start).toISOString(),
        sourceKind: plan.kind,
        sourceIds: ids,
      });

      this.logger.log(
        `Synthesised ${period.ref.system}/${period.ref.scale} "${period.name}" for ` +
          `workspace ${workspaceId} from ${ids.length} ${plan.kind}`,
      );
      return { generated: true };
    }

    // A period nobody recorded is not a period to narrate. Calling a model here
    // is what once produced summaries of empty months describing events that
    // never happened.
    return { generated: false, reason: 'no sources' };
  }

  /**
   * The concrete ids a plan resolves to.
   *
   * This is the boundary: Time answers "what belongs to this period" and hands
   * Journal a list. Journal never sees a date range as a selector.
   */
  private async resolveSourceIds(workspaceId: string, plan: SourcePlan): Promise<string[]> {
    const { start, end } = plan.range;
    if (!end) return [];

    if (plan.kind === 'entries') {
      // An entry carries the moment it was lived in `properties.date`, which is
      // not the same as when it was ingested: a note spoken at 23:50 and
      // transcribed at 00:05 belongs to the day it was spoken.
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Block"
        WHERE "workspaceId" = ${workspaceId}
          AND type = 'journal_entry'
          AND "deletedAt" IS NULL
          AND (properties->>'date')::timestamptz >= ${start}
          AND (properties->>'date')::timestamptz <  ${end}
        ORDER BY (properties->>'date')::timestamptz ASC
      `;
      return rows.map((r) => r.id);
    }

    // Syntheses of the scale below, matched on the period each describes.
    //
    // A synthesis records only its from/to, not which scale produced it, so the
    // scale is recovered from the span: the sub-periods of this range are
    // resolved and each synthesis is matched to one by its exact start. Exact
    // rather than approximate because both come from the same calculation, and
    // a synthesis whose start matches no sub-period boundary is of some other
    // scale and must not be read in.
    if (!plan.fromScale) return [];

    const ctx = await this.time.resolveContext(workspaceId, gregorian.id, start);
    const subPeriods = gregorianPeriodsIn(plan.fromScale, plan.range, ctx);
    if (subPeriods.length === 0) return [];

    const boundaries = subPeriods.map((p) => p.interval.start);

    const rows = await this.prisma.$queryRaw<{ id: string; from: Date }[]>`
      SELECT id, (properties->>'from')::timestamptz AS from
      FROM "Block"
      WHERE "workspaceId" = ${workspaceId}
        AND type = 'journal_synthesis'
        AND "deletedAt" IS NULL
        AND (properties->>'from')::timestamptz >= ${start}
        AND (properties->>'from')::timestamptz <  ${end}
      ORDER BY (properties->>'from')::timestamptz ASC
    `;

    const wanted = new Set(boundaries.map((b) => b.getTime()));
    return rows.filter((r) => wanted.has(new Date(r.from).getTime())).map((r) => r.id);
  }

  /**
   * How much material a candidate set holds, without loading its text.
   *
   * Character length stands in for tokens deliberately: an exact count would
   * mean tokenising every entry to answer a question used only to choose
   * between two plans. Four characters per token is the usual rough ratio.
   */
  private async densityOf(
    workspaceId: string,
    plan: SourcePlan,
    ids: string[],
  ): Promise<{ count: number; estimatedTokens: number }> {
    const field = plan.kind === 'entries' ? 'text' : 'synthesis';
    const rows = await this.prisma.$queryRaw<{ chars: bigint | null }[]>`
      SELECT COALESCE(SUM(length(properties->>${field})), 0)::bigint AS chars
      FROM "Block"
      WHERE "workspaceId" = ${workspaceId} AND id = ANY(${ids})
    `;

    const chars = Number(rows[0]?.chars ?? 0);
    return { count: ids.length, estimatedTokens: Math.ceil(chars / 4) };
  }
}
