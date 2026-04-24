import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SocialProfilesService } from './social-profiles.service';
import { CreateSocialProfileDto, UpdateSocialProfileDto } from './social-profiles.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

@Controller()
export class SocialProfilesController {
  constructor(private readonly svc: SocialProfilesService) {}

  @Get('brands/:brandId/social-profiles')
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AccessTokenPayload, @Param('brandId') brandId: string) {
    return this.svc.listByBrand(user.sub, brandId);
  }

  @Post('brands/:brandId/social-profiles')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('brandId') brandId: string,
    @Body() dto: CreateSocialProfileDto,
  ) {
    return this.svc.create(user.sub, brandId, dto);
  }

  @Get('social-profiles/:profileId')
  @UseGuards(JwtAuthGuard)
  getOne(@CurrentUser() user: AccessTokenPayload, @Param('profileId') profileId: string) {
    return this.svc.getById(user.sub, profileId);
  }

  @Patch('social-profiles/:profileId')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('profileId') profileId: string,
    @Body() dto: UpdateSocialProfileDto,
  ) {
    return this.svc.update(user.sub, profileId, dto);
  }

  @Delete('social-profiles/:profileId')
  @UseGuards(JwtAuthGuard)
  delete(@CurrentUser() user: AccessTokenPayload, @Param('profileId') profileId: string) {
    return this.svc.delete(user.sub, profileId);
  }

  // ── Service routes ──────────────────────────────────────────────────────────

  @Get('_service/brands/:brandId/social-profiles')
  @UseGuards(ServiceAuthGuard)
  listService(@Param('brandId') brandId: string) {
    return this.svc.listByBrandService(brandId);
  }

  @Post('_service/brands/:brandId/social-profiles')
  @UseGuards(ServiceAuthGuard)
  createService(@Param('brandId') brandId: string, @Body() dto: CreateSocialProfileDto) {
    return this.svc.createService(brandId, dto);
  }

  @Delete('_service/social-profiles/:profileId')
  @UseGuards(ServiceAuthGuard)
  deleteService(@Param('profileId') profileId: string) {
    return this.svc.deleteService(profileId);
  }
}
