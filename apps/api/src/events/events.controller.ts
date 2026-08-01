import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body()
    dto: {
      blockId: string;
      type: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.eventsService.create(
      user.sub,
      dto.blockId,
      dto.type,
      dto.metadata,
    );
  }

  @Get('block/:blockId')
  findByBlock(
    @CurrentUser() user: AccessTokenPayload,
    @Param('blockId') blockId: string,
  ) {
    return this.eventsService.findByBlock(user.sub, blockId);
  }
}
