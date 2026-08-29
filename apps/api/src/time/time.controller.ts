import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { gregorian, type SystemConfig } from '@nau/time';
import type { AccessTokenPayload } from '@nau/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkspaceTimeService } from './workspace-time.service';
import { PlanningService } from './planning.service';
import { PeriodsService } from './periods.service';

/**
 * The Time module's HTTP surface.
 *
 * Two things are exposed and nothing else: which periods exist, and where a
 * block sits among them. What a block *means* — that it is an action, that it
 * is done, how long it should take — belongs to whoever owns that block, and
 * asking here would put Actions' vocabulary inside Time.
 */
@Controller('time')
@UseGuards(JwtAuthGuard)
export class TimeController {
  constructor(
    private readonly time: WorkspaceTimeService,
    private readonly planning: PlanningService,
    private readonly periods: PeriodsService,
  ) {}

  private workspaceOf(user: AccessTokenPayload, given?: string): string {
    const workspaceId = given ?? user.workspaceId;
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    return workspaceId;
  }

  // ── Systems ───────────────────────────────────────────────────────────────

  /** Every system this workspace can use, with its settings. */
  @Get('systems')
  async systems(
    @CurrentUser() user: AccessTokenPayload,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = this.workspaceOf(user, workspaceId);
    const systems = await this.time.forWorkspace(ws);

    return {
      systems: systems.map(({ system, enabled, config }) => ({
        id: system.id,
        name: system.name,
        enabled,
        config,
        capabilities: system.capabilities,
        scales: system.scales.map((s) => ({
          id: s.id,
          name: s.name,
          typicalMs: s.typicalMs,
          parent: s.parent ?? null,
        })),
      })),
    };
  }

  /**
   * Changes a system's settings.
   *
   * Reindexing follows immediately: every stored interval is derived from
   * {system, scale, anchor}, and changing where a week begins moves the
   * instants those periods occupy. Leaving the cache stale would let it
   * disagree with the identity it was built from.
   */
  @Patch('systems/:system')
  async updateSystem(
    @CurrentUser() user: AccessTokenPayload,
    @Param('system') system: string,
    @Body() body: { workspaceId?: string; config: SystemConfig },
  ) {
    const ws = this.workspaceOf(user, body.workspaceId);

    try {
      const config = await this.time.updateConfig(ws, system, body.config ?? {});
      const reindexed = await this.planning.reindexWorkspace(ws);
      return { system, config, reindexed };
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : String(err));
    }
  }

  // ── Periods ───────────────────────────────────────────────────────────────

  /** The periods of one scale across a range, resolved in the workspace's zone. */
  @Get('periods')
  async periodsIn(
    @CurrentUser() user: AccessTokenPayload,
    @Query('scale') scale: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('system') system = gregorian.id,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = this.workspaceOf(user, workspaceId);
    if (!scale || !from || !to) {
      throw new BadRequestException('scale, from and to are required');
    }
    return this.periods.periodsIn(ws, system, scale, from, to);
  }

  /** The period of one scale containing an instant. */
  @Get('period')
  async periodAt(
    @CurrentUser() user: AccessTokenPayload,
    @Query('scale') scale: string,
    @Query('at') at: string,
    @Query('system') system = gregorian.id,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = this.workspaceOf(user, workspaceId);
    if (!scale || !at) throw new BadRequestException('scale and at are required');
    return this.periods.periodAt(ws, system, scale, at);
  }

  /**
   * Names a period, or renames it.
   *
   * The title belongs to the period rather than to any synthesis of it: a
   * future period can be named before it holds anything, and regenerating a
   * synthesis must not put the name at risk.
   */
  @Patch('period/title')
  async setTitle(
    @CurrentUser() user: AccessTokenPayload,
    @Body()
    body: {
      workspaceId?: string;
      system?: string;
      scale: string;
      anchor: string;
      title: string | null;
    },
  ) {
    const ws = this.workspaceOf(user, body.workspaceId);
    if (!body.scale || !body.anchor) {
      throw new BadRequestException('scale and anchor are required');
    }
    return this.periods.setTitle(
      ws,
      body.system ?? gregorian.id,
      body.scale,
      new Date(body.anchor),
      body.title,
    );
  }

  // ── Planning ──────────────────────────────────────────────────────────────

  /** Places a block in a period, or moves it to another. */
  @Post('planning')
  async upsertPlanning(
    @CurrentUser() user: AccessTokenPayload,
    @Body()
    body: {
      blockId: string;
      system?: string;
      scale?: string;
      anchor: string;
      recurrence?: string | null;
      recurrenceTimezone?: string | null;
      recurrenceMode?: 'FIXED' | 'AFTER_COMPLETION';
      recurrenceUntil?: string | null;
    },
  ) {
    if (!body.blockId || !body.anchor) {
      throw new BadRequestException('blockId and anchor are required');
    }

    return this.planning.upsert(user.sub, {
      blockId: body.blockId,
      ...(body.system ? { system: body.system } : {}),
      ...(body.scale ? { scale: body.scale } : {}),
      anchor: new Date(body.anchor),
      recurrence: body.recurrence ?? null,
      recurrenceTimezone: body.recurrenceTimezone ?? null,
      recurrenceMode: body.recurrenceMode ?? 'FIXED',
      recurrenceUntil: body.recurrenceUntil ? new Date(body.recurrenceUntil) : null,
    });
  }

  @Get('planning/:blockId')
  findPlanning(
    @CurrentUser() user: AccessTokenPayload,
    @Param('blockId') blockId: string,
  ) {
    return this.planning.findOne(user.sub, blockId);
  }

  @Delete('planning/:id')
  removePlanning(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.planning.remove(user.sub, id);
  }
}
