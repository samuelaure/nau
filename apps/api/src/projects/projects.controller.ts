import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

@Controller()
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  // ── User routes ────────────────────────────────────────────────────────────

  @Get('workspaces/:workspaceId/projects')
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AccessTokenPayload, @Param('workspaceId') workspaceId: string) {
    return this.svc.listByWorkspace(user.sub, workspaceId);
  }

  @Post('workspaces/:workspaceId/projects')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.svc.create(user.sub, workspaceId, dto);
  }

  @Get('projects/:projectId')
  @UseGuards(JwtAuthGuard)
  getOne(@CurrentUser() user: AccessTokenPayload, @Param('projectId') projectId: string) {
    return this.svc.getById(user.sub, projectId);
  }

  @Patch('projects/:projectId')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.svc.update(user.sub, projectId, dto);
  }

  @Delete('projects/:projectId')
  @UseGuards(JwtAuthGuard)
  delete(@CurrentUser() user: AccessTokenPayload, @Param('projectId') projectId: string) {
    return this.svc.delete(user.sub, projectId);
  }

  // ── Service routes ──────────────────────────────────────────────────────────

  @Get('_service/workspaces/:workspaceId/projects')
  @UseGuards(ServiceAuthGuard)
  listService(@Param('workspaceId') workspaceId: string) {
    return this.svc.listByWorkspaceService(workspaceId);
  }

  @Post('_service/workspaces/:workspaceId/projects')
  @UseGuards(ServiceAuthGuard)
  createService(@Param('workspaceId') workspaceId: string, @Body() dto: CreateProjectDto) {
    return this.svc.createService(workspaceId, dto);
  }

  @Get('_service/projects/:projectId')
  @UseGuards(ServiceAuthGuard)
  getOneService(@Param('projectId') projectId: string) {
    return this.svc.getByIdService(projectId);
  }

  @Delete('_service/projects/:projectId')
  @UseGuards(ServiceAuthGuard)
  deleteService(@Param('projectId') projectId: string) {
    return this.svc.deleteService(projectId);
  }
}
