import { Injectable } from '@nestjs/common';
import {
  SystemRegistry,
  ZoneHistory,
  gregorian,
  readGregorianConfig,
  type ResolveContext,
  type SystemConfig,
  type SystemId,
  type TimeSystem,
} from '@nau/time';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Which time systems a workspace uses, and how each is configured.
 *
 * Resolved in one place because several callers need the same answer and a
 * disagreement between them would be invisible: the journal would summarise one
 * week while the agenda drew another, and nothing would say so. That is not
 * hypothetical — it is exactly what happened when the calendar config was an
 * optional parameter and Journal simply never passed it.
 *
 * Which is why `ResolveContext` here is always complete. A caller cannot obtain
 * a half-built context, so the next such omission is a compile error rather
 * than a silent divergence a user finds months later.
 */

/** Systems available to every workspace. Registration is the extension point. */
const REGISTERED_SYSTEMS: readonly TimeSystem[] = [gregorian];

export interface WorkspaceTimeSystem {
  readonly system: TimeSystem;
  readonly enabled: boolean;
  readonly config: SystemConfig;
}

@Injectable()
export class WorkspaceTimeService {
  private readonly registry = new SystemRegistry(REGISTERED_SYSTEMS);

  constructor(private readonly prisma: PrismaService) {}

  /** Every system this platform knows how to compute, configured or not. */
  systems(): readonly TimeSystem[] {
    return this.registry.all();
  }

  registry_(): SystemRegistry {
    return this.registry;
  }

  /**
   * Where a workspace has lived, in order.
   *
   * A period of the past is resolved with the zone in force then, so a person
   * who moves from Madrid to Mexico City still sees August as they lived it.
   * `Workspace.timezone` is the current value and acts as the fallback for any
   * instant before the history begins.
   */
  async zoneHistory(workspaceId: string): Promise<ZoneHistory> {
    const [workspace, changes] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { timezone: true },
      }),
      this.prisma.workspaceTimezone.findMany({
        where: { workspaceId },
        orderBy: { effectiveAt: 'asc' },
        select: { timezone: true, effectiveAt: true },
      }),
    ]);

    if (changes.length === 0) {
      return ZoneHistory.fixed(workspace?.timezone ?? 'UTC');
    }

    return new ZoneHistory(
      changes.map((c) => ({ timezone: c.timezone, effectiveAt: c.effectiveAt })),
      workspace?.timezone ?? 'UTC',
    );
  }

  /**
   * The context needed to resolve periods of one system, at one moment.
   *
   * `at` decides which timezone applies, which is the whole reason it is a
   * parameter rather than assumed to be now: resolving "August 2026" for a
   * workspace that has since moved must use the zone of August 2026.
   */
  async resolveContext(
    workspaceId: string,
    systemId: SystemId,
    at: Date = new Date(),
  ): Promise<ResolveContext> {
    const [history, config] = await Promise.all([
      this.zoneHistory(workspaceId),
      this.configFor(workspaceId, systemId),
    ]);

    return { timezone: history.at(at), config };
  }

  /**
   * A system's settings for this workspace.
   *
   * A row exists only where the workspace changed something; otherwise the
   * system's own defaults apply. There is deliberately no shared built-in row
   * for every workspace to borrow — one mutable row that everyone reads is a
   * single write away from changing the week for all of them at once.
   */
  async configFor(workspaceId: string, systemId: SystemId): Promise<SystemConfig> {
    const row = await this.prisma.timeSystemConfig.findUnique({
      where: { workspaceId_system: { workspaceId, system: systemId } },
      select: { config: true },
    });

    return (row?.config ?? {}) as SystemConfig;
  }

  /** Every system this workspace has configured, with whether it is active. */
  async forWorkspace(workspaceId: string): Promise<readonly WorkspaceTimeSystem[]> {
    const rows = await this.prisma.timeSystemConfig.findMany({ where: { workspaceId } });
    const byId = new Map(rows.map((r) => [r.system, r]));

    return this.registry.all().map((system) => {
      const row = byId.get(system.id);
      return {
        system,
        // A system with no row is available but not switched on, except for
        // Gregorian, which every workspace starts with.
        enabled: row?.enabled ?? system.id === gregorian.id,
        config: (row?.config ?? {}) as SystemConfig,
      };
    });
  }

  /**
   * Changes a system's settings, creating the row on first write.
   *
   * Validation is delegated to the system itself: only Gregorian knows that
   * `firstDayOfWeek` must be 0 or 1, and only the naŭ calendar will know what
   * its own settings mean.
   */
  async updateConfig(
    workspaceId: string,
    systemId: SystemId,
    patch: SystemConfig,
  ): Promise<SystemConfig> {
    const system = this.registry.get(systemId);
    const current = await this.configFor(workspaceId, systemId);
    const config = { ...current, ...patch };

    const problems = system.validateConfig?.(config) ?? [];
    if (problems.length > 0) {
      throw new Error(`Invalid ${systemId} config: ${problems.join('; ')}`);
    }

    await this.prisma.timeSystemConfig.upsert({
      where: { workspaceId_system: { workspaceId, system: systemId } },
      create: { workspaceId, system: systemId, config: config as object },
      update: { config: config as object },
    });

    return config;
  }

  /** Convenience for the common case, since Gregorian is what most code asks. */
  async gregorianConfig(workspaceId: string) {
    return readGregorianConfig(await this.configFor(workspaceId, gregorian.id));
  }
}
