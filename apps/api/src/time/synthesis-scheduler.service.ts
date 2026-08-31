import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  exceedsBudget,
  gregorian,
  gregorianClosedPeriodAt,
  gregorianPeriodsIn,
  gregorianJournal,
  localNow,
  type Interval,
  type Period,
  type ResolveContext,
  type SourcePlan,
} from '@nau/time';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceTimeService } from './workspace-time.service';
import { JournalService, type JournalSourceRow } from '../journal/journal.service';

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
   * Builds one period's synthesis, generating what it depends on first.
   *
   * The rule, for Gregorian: a day and a week read the entries themselves; a
   * month reads daily syntheses, a quarter weekly ones, a year monthly ones.
   *
   * So asking for a year can require most of a calendar to be built from
   * nothing. If a month's synthesis is missing, it is generated before the year
   * that needs it — and if that month's own days are missing, they are
   * generated first in turn. The recursion walks down until it reaches entries,
   * then builds back up.
   *
   * The one thing that stops the descent is absence of material rather than
   * absence of a synthesis. A week nobody wrote in is skipped, not generated
   * empty: it has nothing to say, and a summary of it would be invented.
   */
  async synthesise(
    workspaceId: string,
    period: Period,
    ctx: ResolveContext,
    depth = 0,
  ): Promise<{ generated: boolean; reason?: string }> {
    // A guard, not a policy. Gregorian nests four deep (year → month → day), so
    // anything beyond this is a cycle in a system's own composition rule.
    if (depth > 8) {
      this.logger.error(`Composition depth exceeded at ${period.ref.scale} — check the rule`);
      return { generated: false, reason: 'depth' };
    }

    const [plan] = gregorianJournal.preferredSources(period, ctx);
    if (!plan) return { generated: false, reason: 'no plan' };

    // Everything larger than a week is built from smaller syntheses, so the
    // ones that are missing have to exist before this one can be asked for.
    if (plan.kind === 'syntheses' && plan.fromScale) {
      await this.ensureSubSyntheses(workspaceId, period, plan.fromScale, ctx, depth);
    }

    const sources = await this.resolveSources(workspaceId, plan);
    if (sources.length === 0) {
      // A period nobody recorded is not a period to narrate. Calling a model
      // here is what once produced summaries of empty months describing events
      // that never happened.
      return { generated: false, reason: 'no sources' };
    }

    const density = this.density(sources);

    if (gregorianJournal.shouldSynthesise?.(period, density) === false) {
      return { generated: false, reason: 'empty' };
    }

    // Measured, not enforced. The rule stays fixed and the numbers accumulate,
    // so that any future limit is set against real volume rather than a guess.
    if (exceedsBudget(density)) {
      this.logger.warn(
        `Large synthesis: ${period.ref.scale} "${period.name}" for workspace ` +
          `${workspaceId} — ${sources.length} ${plan.kind}, ~${density.estimatedTokens} tokens`,
      );
    }

    await this.journal.generateSynthesis({
      workspaceId,
      from: period.interval.start.toISOString(),
      to: (period.interval.end ?? period.interval.start).toISOString(),
      sourceKind: plan.kind,
      sourceIds: sources.map((s) => s.id),
    });

    this.logger.log(
      `Synthesised ${period.ref.system}/${period.ref.scale} "${period.name}" for ` +
        `workspace ${workspaceId} from ${sources.length} ${plan.kind} ` +
        `(~${density.estimatedTokens} tokens)`,
    );
    return { generated: true };
  }

  /**
   * Generates the smaller syntheses this period is composed of, where missing.
   *
   * "Missing" means the sub-period has material but no synthesis. A sub-period
   * with nothing in it is left alone: it is not a gap to fill, it is a stretch
   * where nothing was written, and the period above simply has one fewer source.
   */
  private async ensureSubSyntheses(
    workspaceId: string,
    period: Period,
    fromScale: string,
    ctx: ResolveContext,
    depth: number,
  ): Promise<void> {
    const subPeriods = gregorianPeriodsIn(fromScale, period.interval, ctx);
    if (subPeriods.length === 0) return;

    const existing = await this.existingSyntheses(workspaceId, period.interval, fromScale, ctx);

    for (const sub of subPeriods) {
      if (existing.has(sub.interval.start.getTime())) continue;
      await this.synthesise(workspaceId, sub, ctx, depth + 1);
    }
  }

  /**
   * The starts of the sub-periods that already have a synthesis.
   *
   * A synthesis records its from/to but not which scale produced it, so the
   * scale is recovered by matching each one's start against a real sub-period
   * boundary. Exact rather than approximate, because both come from the same
   * calculation — and a synthesis matching no boundary belongs to another scale
   * and must not be counted here.
   */
  private async existingSyntheses(
    workspaceId: string,
    range: Interval,
    scale: string,
    ctx: ResolveContext,
  ): Promise<Set<number>> {
    if (!range.end) return new Set();

    const boundaries = new Set(
      gregorianPeriodsIn(scale, range, ctx).map((p) => p.interval.start.getTime()),
    );

    const rows = await this.journal.synthesesStartingIn(workspaceId, {
      start: range.start,
      end: range.end,
    });

    return new Set(rows.map((r) => r.at.getTime()).filter((t) => boundaries.has(t)));
  }

  /**
   * The concrete rows a plan resolves to.
   *
   * This is the boundary: Time answers "what belongs to this period" and hands
   * Journal a list of ids. Journal never sees a date range as a selector — the
   * lookup by date happens here, against the typed contract Journal exposes
   * (`entriesIn` / `synthesesStartingIn`), never against `properties` directly.
   * See nau#63: reading Journal's storage format from here was coupling no
   * compiler or test could see, because it lived inside a SQL string.
   */
  private async resolveSources(
    workspaceId: string,
    plan: SourcePlan,
  ): Promise<JournalSourceRow[]> {
    const { start, end } = plan.range;
    if (!end) return [];

    if (plan.kind === 'entries') {
      return this.journal.entriesIn(workspaceId, { start, end });
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

    const boundaries = new Set(subPeriods.map((p) => p.interval.start.getTime()));
    const rows = await this.journal.synthesesStartingIn(workspaceId, { start, end });
    return rows.filter((r) => boundaries.has(r.at.getTime()));
  }

  /**
   * How much material a set of rows holds, without loading its full text.
   *
   * Character length stands in for tokens deliberately: an exact count would
   * mean tokenising every entry to answer a question used only for logging.
   * Four characters per token is the usual rough ratio. Journal supplies the
   * length alongside each row, so this is arithmetic on data already fetched
   * rather than a second query.
   */
  private density(rows: readonly JournalSourceRow[]): { count: number; estimatedTokens: number } {
    const chars = rows.reduce((total, row) => total + row.textLength, 0);
    return { count: rows.length, estimatedTokens: Math.ceil(chars / 4) };
  }
}
