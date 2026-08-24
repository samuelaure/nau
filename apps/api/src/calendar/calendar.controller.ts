import { Controller, Get, Patch, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  async forWorkspace(
    @CurrentUser() user: AccessTokenPayload,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const ws = workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');
    return this.calendar.forWorkspace(ws);
  }

  @Patch()
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: { workspaceId?: string; firstDayOfWeek?: number },
  ) {
    const ws = body.workspaceId ?? user.workspaceId;
    if (!ws) throw new BadRequestException('workspaceId is required');

    if (body.firstDayOfWeek !== undefined && ![0, 1].includes(body.firstDayOfWeek)) {
      throw new BadRequestException('firstDayOfWeek must be 0 (Sunday) or 1 (Monday)');
    }

    return this.calendar.updateConfig(user.sub, ws, {
      ...(body.firstDayOfWeek !== undefined ? { firstDayOfWeek: body.firstDayOfWeek } : {}),
    });
  }
}
