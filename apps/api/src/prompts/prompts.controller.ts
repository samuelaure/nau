import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { UpsertPromptDto, PromptFilterDto } from './prompts.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

@Controller('prompts')
export class PromptsController {
  constructor(private readonly svc: PromptsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AccessTokenPayload, @Query() filter: PromptFilterDto) {
    return this.svc.list(user.sub, filter);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  upsert(@CurrentUser() user: AccessTokenPayload, @Body() dto: UpsertPromptDto) {
    return this.svc.upsert(user.sub, dto);
  }

  @Delete(':promptId')
  @UseGuards(JwtAuthGuard)
  delete(@CurrentUser() user: AccessTokenPayload, @Param('promptId') promptId: string) {
    return this.svc.delete(user.sub, promptId);
  }

  // ── Service routes ──────────────────────────────────────────────────────────

  @Get('_service')
  @UseGuards(ServiceAuthGuard)
  listService(@Query() filter: PromptFilterDto) {
    return this.svc.listService(filter);
  }

  @Put('_service')
  @UseGuards(ServiceAuthGuard)
  upsertService(@Body() dto: UpsertPromptDto) {
    return this.svc.upsertService(dto);
  }
}
