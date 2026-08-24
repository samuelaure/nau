import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';
import type { PeriodType } from '../common/time';

const PERIODS = ['daily', 'weekly', 'monthly', 'trimester', 'yearly'] as const;

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
    @Query('period') period: string = 'daily',
    @Query('workspaceId') workspaceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    if (!PERIODS.includes(period as (typeof PERIODS)[number])) {
      throw new BadRequestException(`period must be one of ${PERIODS.join(', ')}`);
    }

    if (from && to) {
      return this.agenda.forRange({
        userId: user.sub,
        workspaceId: ws,
        from,
        to,
        period: period as PeriodType,
      });
    }

    return this.agenda.forPeriod({
      userId: user.sub,
      workspaceId: ws,
      period: period as PeriodType,
      date: date || new Date().toISOString(),
    });
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
