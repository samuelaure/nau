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
      startDate: Date;
      endDate?: Date;
      rrule?: string;
    },
  ) {
    return this.scheduleService.upsert(
      user.sub,
      dto.blockId,
      new Date(dto.startDate),
      dto.endDate ? new Date(dto.endDate) : undefined,
      dto.rrule,
    );
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
