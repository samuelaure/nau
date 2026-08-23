import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

@Controller('schedule')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  upsert(
    @CurrentUser() user: AccessTokenPayload,
    @Body()
    dto: {
      blockId: string;
      startDate: string;
      endDate?: string | null;
      rrule?: string | null;
      timezone?: string | null;
      recurrenceMode?: 'FIXED' | 'AFTER_COMPLETION';
    },
  ) {
    return this.scheduleService.upsert(user.sub, {
      blockId: dto.blockId,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      rrule: dto.rrule ?? null,
      timezone: dto.timezone ?? null,
      recurrenceMode: dto.recurrenceMode ?? 'FIXED',
    });
  }

  @Get(':blockId')
  findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('blockId') blockId: string,
  ) {
    return this.scheduleService.findOne(user.sub, blockId);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.scheduleService.remove(user.sub, id);
  }
}
