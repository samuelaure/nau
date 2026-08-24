import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { safeZone, type CalendarConfig } from '../common/time';

export interface WorkspaceCalendar {
  /** The zone the workspace's periods are lived in. */
  timezone: string;
  /** Settings belonging to the calendar itself, not to any person. */
  config: CalendarConfig;
  /** Null while the workspace is still using the built-in calendar. */
  calendarId: string | null;
  kind: string;
}

/**
 * Which calendar a workspace divides time with, and how it is configured.
 *
 * Resolved in one place because two services need the same answer and a
 * disagreement between them would be invisible: the journal would summarise one
 * week while the agenda showed another.
 *
 * A workspace uses the built-in calendar until it configures one, at which point
 * it gets a row of its own that overrides it. That is what `Calendar.workspaceId`
 * being nullable was always for.
 */
@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
  ) {}

  async forWorkspace(workspaceId: string): Promise<WorkspaceCalendar> {
    const [workspace, calendars] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { timezone: true },
      }),
      this.prisma.calendar.findMany({
        where: { kind: 'GREGORIAN', OR: [{ workspaceId }, { workspaceId: null }] },
      }),
    ]);

    // The workspace's own row wins over the shared built-in.
    const own = calendars.find((c) => c.workspaceId === workspaceId);
    const builtIn = calendars.find((c) => c.workspaceId === null);
    const active = own ?? builtIn ?? null;

    return {
      timezone: safeZone(workspace?.timezone),
      config: (active?.config ?? {}) as CalendarConfig,
      calendarId: own?.id ?? null,
      kind: active?.kind ?? 'GREGORIAN',
    };
  }

  /**
   * Changes a setting on the workspace's calendar, creating its own row the
   * first time.
   *
   * The built-in row is shared by every workspace, so writing to it would change
   * the week for everyone. The first change is what makes a workspace stop
   * borrowing and start owning.
   */
  async updateConfig(
    userId: string,
    workspaceId: string,
    patch: CalendarConfig,
  ): Promise<WorkspaceCalendar> {
    await this.blocks.assertWorkspaceMembership(userId, workspaceId);

    const current = await this.forWorkspace(workspaceId);
    const config = { ...current.config, ...patch };

    if (current.calendarId) {
      await this.prisma.calendar.update({ where: { id: current.calendarId }, data: { config } });
    } else {
      await this.prisma.calendar.create({
        data: { kind: 'GREGORIAN', name: 'Gregoriano', workspaceId, isDefault: true, config },
      });
    }

    return this.forWorkspace(workspaceId);
  }
}
