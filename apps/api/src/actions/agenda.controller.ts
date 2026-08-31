import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

/**
 * The Gregorian scales an agenda can be drawn at.
 *
 * Named for the scale rather than for the rhythm — 'day' rather than 'daily' —
 * because a scale is a division of time, not a frequency. The two vocabularies
 * used to coexist, one on each side of the wire, and translating between them
 * was pure ceremony.
 */
const SCALES = ['day', 'week', 'month', 'quarter', 'year'] as const;

@Controller('agenda')
@UseGuards(JwtAuthGuard)
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  /**
   * One period, or a span of them.
   *
   * `from`/`to` answers the view that lists a run of periods at once, which is
   * how home works — asking period by period would be one request per day on
   * screen. `period` still matters there: it says at what granularity carry-over
   * should match, since an action deferred to a month belongs in the month view
   * and not in today's list.
   */
  @Get()
  async forPeriod(
    @CurrentUser() user: AccessTokenPayload,
    @Query('date') date: string,
    @Query('scale') scale: string = 'day',
    @Query('workspaceId') workspaceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    if (!SCALES.includes(scale as (typeof SCALES)[number])) {
      throw new BadRequestException(`scale must be one of ${SCALES.join(', ')}`);
    }

    if (from && to) {
      return this.agenda.forRange({
        userId: user.sub,
        workspaceId: ws,
        from,
        to,
        scale,
      });
    }

    return this.agenda.forPeriod({
      userId: user.sub,
      workspaceId: ws,
      scale,
      date: date || new Date().toISOString(),
    });
  }

  /** What has no period at all. See AgendaService.nextActions. */
  @Get('next')
  async nextActions(
    @CurrentUser() user: AccessTokenPayload,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    return this.agenda.nextActions({ userId: user.sub, workspaceId: ws });
  }

  @Post('complete')
  async setCompletion(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: { blockId: string; occurrenceAt: string; done: boolean },
  ) {
    if (!body.blockId || !body.occurrenceAt) {
      throw new BadRequestException('blockId and occurrenceAt are required');
    }
    return this.agenda.setCompletion({
      userId: user.sub,
      blockId: body.blockId,
      occurrenceAt: body.occurrenceAt,
      done: body.done !== false,
    });
  }

  @Post('reorder')
  async reorder(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: { workspaceId?: string; blockIds: string[] },
  ) {
    const ws = body.workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    if (!Array.isArray(body.blockIds) || body.blockIds.length === 0) {
      throw new BadRequestException('blockIds must be a non-empty array');
    }
    return this.agenda.reorder({ userId: user.sub, workspaceId: ws, blockIds: body.blockIds });
  }
}
