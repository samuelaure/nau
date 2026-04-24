import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, AddMemberDto } from './workspaces.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { IsString } from 'class-validator';
import type { AccessTokenPayload } from '@nau/types';

class UpdateWorkspaceDto {
  @IsString()
  name!: string;
}

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly svc: WorkspacesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getWorkspaces(@CurrentUser() user: AccessTokenPayload) {
    return this.svc.getWorkspacesForUser(user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createWorkspace(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateWorkspaceDto) {
    return this.svc.createWorkspace(user.sub, dto);
  }

  @Get(':workspaceId')
  @UseGuards(JwtAuthGuard)
  getWorkspace(@CurrentUser() user: AccessTokenPayload, @Param('workspaceId') workspaceId: string) {
    return this.svc.assertMembership(user.sub, workspaceId).then(() =>
      this.svc.getWorkspaceById(workspaceId),
    );
  }

  @Patch(':workspaceId')
  @UseGuards(JwtAuthGuard)
  updateWorkspace(
    @CurrentUser() user: AccessTokenPayload,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.svc.renameWorkspace(user.sub, workspaceId, dto.name);
  }

  @Delete(':workspaceId')
  @UseGuards(JwtAuthGuard)
  deleteWorkspace(@CurrentUser() user: AccessTokenPayload, @Param('workspaceId') workspaceId: string) {
    return this.svc.deleteWorkspace(user.sub, workspaceId);
  }

  // ── Service-to-service ──────────────────────────────────────────────────────

  @Get('_service/user/:userId')
  @UseGuards(ServiceAuthGuard)
  getWorkspacesForUserService(@Param('userId') userId: string) {
    return this.svc.getWorkspacesForUser(userId);
  }

  @Get('_service/:workspaceId')
  @UseGuards(ServiceAuthGuard)
  getWorkspaceService(@Param('workspaceId') workspaceId: string) {
    return this.svc.getWorkspaceById(workspaceId);
  }

  // ── Members ─────────────────────────────────────────────────────────────────

  @Get(':workspaceId/members')
  @UseGuards(JwtAuthGuard)
  getMembers(@CurrentUser() user: AccessTokenPayload, @Param('workspaceId') workspaceId: string) {
    return this.svc.getWorkspaceMembers(user.sub, workspaceId);
  }

  @Post(':workspaceId/members')
  @UseGuards(JwtAuthGuard)
  addMember(
    @CurrentUser() user: AccessTokenPayload,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.svc.addMemberByEmail(user.sub, workspaceId, dto);
  }

  @Put(':workspaceId/members/:targetUserId')
  @UseGuards(JwtAuthGuard)
  updateMemberRole(
    @CurrentUser() user: AccessTokenPayload,
    @Param('workspaceId') workspaceId: string,
    @Param('targetUserId') targetUserId: string,
    @Body('role') role: WorkspaceRole,
  ) {
    return this.svc.updateMemberRole(user.sub, workspaceId, targetUserId, role);
  }

  @Delete(':workspaceId/members/:targetUserId')
  @UseGuards(JwtAuthGuard)
  removeMember(
    @CurrentUser() user: AccessTokenPayload,
    @Param('workspaceId') workspaceId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.svc.removeMember(user.sub, workspaceId, targetUserId);
  }
}
