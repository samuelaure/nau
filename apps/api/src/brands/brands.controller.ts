import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { CreateBrandDto, UpdateBrandDto } from './brands.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

@Controller()
export class BrandsController {
  constructor(private readonly svc: BrandsService) {}

  // ── User routes (under /workspaces/:workspaceId/brands) ────────────────────

  @Get('workspaces/:workspaceId/brands')
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AccessTokenPayload, @Param('workspaceId') workspaceId: string) {
    return this.svc.listByWorkspace(user.sub, workspaceId);
  }

  @Post('workspaces/:workspaceId/brands')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateBrandDto,
  ) {
    return this.svc.create(user.sub, workspaceId, dto);
  }

  @Get('brands/:brandId')
  @UseGuards(JwtAuthGuard)
  getOne(@CurrentUser() user: AccessTokenPayload, @Param('brandId') brandId: string) {
    return this.svc.getById(user.sub, brandId);
  }

  @Patch('brands/:brandId')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('brandId') brandId: string,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.svc.update(user.sub, brandId, dto);
  }

  @Delete('brands/:brandId')
  @UseGuards(JwtAuthGuard)
  delete(@CurrentUser() user: AccessTokenPayload, @Param('brandId') brandId: string) {
    return this.svc.delete(user.sub, brandId);
  }

  // ── Service routes ──────────────────────────────────────────────────────────

  @Get('_service/workspaces/:workspaceId/brands')
  @UseGuards(ServiceAuthGuard)
  listService(@Param('workspaceId') workspaceId: string) {
    return this.svc.listByWorkspaceService(workspaceId);
  }

  @Post('_service/workspaces/:workspaceId/brands')
  @UseGuards(ServiceAuthGuard)
  createService(@Param('workspaceId') workspaceId: string, @Body() dto: CreateBrandDto) {
    return this.svc.createService(workspaceId, dto);
  }

  @Get('_service/brands/:brandId')
  @UseGuards(ServiceAuthGuard)
  getOneService(@Param('brandId') brandId: string) {
    return this.svc.getByIdService(brandId);
  }

  @Delete('_service/brands/:brandId')
  @UseGuards(ServiceAuthGuard)
  deleteService(@Param('brandId') brandId: string) {
    return this.svc.deleteService(brandId);
  }
}
