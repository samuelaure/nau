import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { Request } from 'express'
import { ProjectsService } from './projects.service'
import { ServiceAuthGuard } from '../auth/service-auth.guard'
import { AnyAuthGuard } from '../auth/any-auth.guard'
import { COOKIE_ACCESS_TOKEN, extractBearerToken } from '@nau/auth'

@Controller()
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  // ── Workspace overview (brands + projects) ─────────────────────────────────

  @Get('workspace/:workspaceId/overview')
  @UseGuards(AnyAuthGuard)
  getOverview(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    const token = (req as any).cookies?.[COOKIE_ACCESS_TOKEN] ?? extractBearerToken(req.headers['authorization']) ?? ''
    return this.svc.getWorkspaceOverview(workspaceId, token)
  }

  // ── Project CRUD (user-facing, proxied from workspaces controller to api) ──
  // Individual project detail routes go through api directly or via proxy.

  // ── _service routes (api → nauthenticity sync) ─────────────────────────────

  @Post('_service/projects/sync')
  @UseGuards(ServiceAuthGuard)
  sync(@Body() body: { id: string; workspaceId: string; brandId?: string | null; name: string; isActive?: boolean }) {
    return this.svc.upsert(body)
  }

  @Get('_service/projects/:projectId')
  @UseGuards(ServiceAuthGuard)
  getOne(@Param('projectId') projectId: string) {
    return this.svc.getById(projectId)
  }

  @Get('_service/workspaces/:workspaceId/projects')
  @UseGuards(ServiceAuthGuard)
  listByWorkspace(@Param('workspaceId') workspaceId: string) {
    return this.svc.listByWorkspace(workspaceId)
  }

  @Delete('_service/projects/:projectId')
  @UseGuards(ServiceAuthGuard)
  delete(@Param('projectId') projectId: string) {
    return this.svc.delete(projectId)
  }
}
