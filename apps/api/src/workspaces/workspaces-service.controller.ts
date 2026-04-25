import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsString, MinLength, IsOptional } from 'class-validator';
import { WorkspacesService } from './workspaces.service';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';

class CreateWorkspaceForUserDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

@Controller('_service/workspaces')
@UseGuards(ServiceAuthGuard)
export class WorkspacesServiceController {
  constructor(private readonly svc: WorkspacesService) {}

  @Get()
  listByUserQuery(@Query('userId') userId: string) {
    return this.svc.getWorkspacesForUser(userId);
  }

  @Get('user/:userId')
  listByUserParam(@Param('userId') userId: string) {
    return this.svc.getWorkspacesForUser(userId);
  }

  @Get(':workspaceId')
  getOne(@Param('workspaceId') workspaceId: string) {
    return this.svc.getWorkspaceById(workspaceId);
  }

  @Post()
  create(@Body() dto: CreateWorkspaceForUserDto) {
    const { userId, ...workspaceDto } = dto;
    return this.svc.createWorkspace(userId, workspaceDto);
  }
}
