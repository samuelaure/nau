import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ServiceAuthGuard } from '../../common/guards/service-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';
import { UsageService, CreateUsageEventDto } from './usage.service';

@Controller()
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  /**
   * Internal endpoint — called by services after each LLM/Apify operation.
   * Protected by service-to-service JWT.
   *
   * `workspaceId` is required. It used to be optional, resolved here from
   * `brandId` by querying the Brand model — a platform-wide observability
   * endpoint reaching into module:content's domain to save its callers a
   * lookup. Cut deliberately rather than carried forward; see the note on
   * `UsageService.record`.
   */
  @Post('_service/usage/events')
  @UseGuards(ServiceAuthGuard)
  async recordEvent(@Body() dto: CreateUsageEventDto) {
    if (!dto.workspaceId) {
      throw new BadRequestException(
        'workspaceId is required — resolve it from your own brandId before calling',
      );
    }
    if (!dto.service || !dto.operation) {
      throw new BadRequestException('service and operation are required');
    }
    return this.usageService.record(dto);
  }

  /**
   * Admin endpoint — workspace-scoped usage summary.
   * Protected by user JWT.
   */
  @Get('admin/usage/summary')
  @UseGuards(JwtAuthGuard)
  async getSummary(
    @CurrentUser() user: AccessTokenPayload,
    @Query('workspaceId') workspaceId?: string,
    @Query('brandId') brandId?: string,
    @Query('service') service?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.usageService.assertAdmin(user.sub);
    return this.usageService.getSummary({
      workspaceId,
      brandId,
      service,
      fromDate: from ? new Date(from) : undefined,
      toDate: to ? new Date(to) : undefined,
    });
  }
}
