import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsageService, CreateUsageEventDto } from './usage.service';

@Controller()
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  /**
   * Internal endpoint — called by services after each LLM/Apify operation.
   * Protected by service-to-service JWT.
   * workspaceId is optional — if omitted, it is resolved from brandId.
   */
  @Post('_service/usage/events')
  @UseGuards(ServiceAuthGuard)
  async recordEvent(@Body() dto: CreateUsageEventDto) {
    if (!dto.service || !dto.operation) {
      throw new BadRequestException('service and operation are required');
    }
    return this.usageService.recordWithResolution(dto);
  }

  /**
   * Admin endpoint — workspace-scoped usage summary.
   * Protected by user JWT.
   */
  @Get('admin/usage/summary')
  @UseGuards(JwtAuthGuard)
  async getSummary(
    @Query('workspaceId') workspaceId?: string,
    @Query('brandId') brandId?: string,
    @Query('service') service?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.usageService.getSummary({
      workspaceId,
      brandId,
      service,
      fromDate: from ? new Date(from) : undefined,
      toDate: to ? new Date(to) : undefined,
    });
  }
}
