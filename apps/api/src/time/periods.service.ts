import { Injectable, BadRequestException } from '@nestjs/common';
import { dayIn, type Period, type SystemId } from '@nau/time';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceTimeService } from './workspace-time.service';

/**
 * Resolving periods, and remembering the few that carry something of their own.
 *
 * Periods are computed. "August 2026" needs no row, and materialising every
 * period of every active system would mean rows forever plus a table that can
 * drift from the rule that generated it.
 *
 * A row appears only when a period acquires something: a title the person gave
 * it, or something else hanging from it. Identity is {system, scale, anchor} —
 * never a from/to match, which fails three ways: two computations of the same
 * period differ by a millisecond, a naŭ and a week that coincide collide, and a
 * timezone change moves the interval and orphans whatever hung from it.
 */
@Injectable()
export class PeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly time: WorkspaceTimeService,
  ) {}

  /** The period of a scale containing an instant, with any title it has. */
  async periodAt(workspaceId: string, systemId: SystemId, scale: string, at: string) {
    const ctx = await this.time.resolveContext(workspaceId, systemId, new Date(at));
    const instant = dayIn(at, ctx.timezone).toDate();

    const period = this.time.registry_().get(systemId).periodAt(scale, instant, ctx);
    if (!period) {
      // A real answer, not a failure: in the naŭ calendar the 28th of a 31-day
      // month belongs to no naŭ, and saying so is better than inventing one.
      return { period: null, timezone: ctx.timezone };
    }

    const [decorated] = await this.withTitles(workspaceId, [period]);
    return { period: decorated, timezone: ctx.timezone };
  }

  /** Every period of a scale across a range. */
  async periodsIn(
    workspaceId: string,
    systemId: SystemId,
    scale: string,
    from: string,
    to: string,
  ) {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('from and to must be valid dates');
    }

    const ctx = await this.time.resolveContext(workspaceId, systemId, start);
    const startInstant = dayIn(from, ctx.timezone).toDate();
    const endInstant = dayIn(to, ctx.timezone).toDate();

    const periods = this.time
      .registry_()
      .get(systemId)
      .periodsIn(scale, { start: startInstant, end: endInstant }, ctx);

    return {
      periods: await this.withTitles(workspaceId, periods),
      timezone: ctx.timezone,
      system: systemId,
      scale,
    };
  }

  /**
   * Sets or clears a period's title.
   *
   * Writing a title is what materialises the period. Clearing it does not
   * delete the row, because something else may hang from it — and a row with no
   * title is simply a period that is referenced, which is not an error state.
   */
  async setTitle(
    workspaceId: string,
    systemId: SystemId,
    scale: string,
    anchor: Date,
    title: string | null,
  ) {
    const ctx = await this.time.resolveContext(workspaceId, systemId, anchor);
    const period = this.time.registry_().get(systemId).periodAt(scale, anchor, ctx);
    if (!period) {
      throw new BadRequestException(
        `The ${systemId} system has no ${scale} period containing that instant`,
      );
    }

    // Stored against the period's own start rather than the instant given, so
    // that two requests naming the same period from different instants inside
    // it resolve to one row rather than two.
    const canonical = period.interval.start;

    const row = await this.prisma.namedPeriod.upsert({
      where: {
        workspaceId_system_scale_anchor: {
          workspaceId,
          system: systemId,
          scale,
          anchor: canonical,
        },
      },
      create: { workspaceId, system: systemId, scale, anchor: canonical, title },
      update: { title },
    });

    return { period: { ...this.shape(period), title: row.title } };
  }

  /**
   * Attaches stored titles to computed periods.
   *
   * One query for the whole range rather than one per period: a year view asks
   * for twelve months, and a day view for thirty-one days.
   */
  private async withTitles(workspaceId: string, periods: readonly Period[]) {
    if (periods.length === 0) return [];

    const rows = await this.prisma.namedPeriod.findMany({
      where: {
        workspaceId,
        system: periods[0]!.ref.system,
        scale: periods[0]!.ref.scale,
        anchor: { in: periods.map((p) => p.interval.start) },
      },
      select: { anchor: true, title: true },
    });

    const titles = new Map(rows.map((r) => [r.anchor.getTime(), r.title]));

    return periods.map((period) => ({
      ...this.shape(period),
      title: titles.get(period.interval.start.getTime()) ?? null,
    }));
  }

  private shape(period: Period) {
    return {
      system: period.ref.system,
      scale: period.ref.scale,
      // The canonical anchor, so a client can name this period back to us.
      anchor: period.interval.start.toISOString(),
      name: period.name,
      from: period.interval.start.toISOString(),
      to: period.interval.end?.toISOString() ?? null,
    };
  }
}
