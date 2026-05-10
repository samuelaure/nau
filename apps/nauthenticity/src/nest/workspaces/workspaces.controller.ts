import { Controller, Get, Post, Patch, Put, Delete, Param, Body, Req, Res, UseGuards } from '@nestjs/common'
import { AnyAuthGuard } from '../auth/any-auth.guard'
import { proxyToApi } from './api-proxy'

@Controller('workspaces')
@UseGuards(AnyAuthGuard)
export class WorkspacesController {
  @Get()
  list(@Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, '/workspaces')
  }

  @Post()
  create(@Body() body: unknown, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, '/workspaces', 'POST', body)
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, `/workspaces/${id}/members`)
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() body: unknown, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, `/workspaces/${id}`, 'PATCH', body)
  }

  @Put(':id/members/:userId')
  updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() req: unknown,
    @Res() res: unknown,
  ) {
    return proxyToApi(req, res, `/workspaces/${id}/members/${userId}`, 'PUT', body)
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: unknown, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, `/workspaces/${id}/members`, 'POST', body)
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: unknown,
    @Res() res: unknown,
  ) {
    return proxyToApi(req, res, `/workspaces/${id}/members/${userId}`, 'DELETE')
  }

  @Get(':id/brands')
  getBrands(@Param('id') id: string, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, `/workspaces/${id}/brands`)
  }

  @Post(':id/brands')
  createBrand(@Param('id') id: string, @Body() body: unknown, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, `/workspaces/${id}/brands`, 'POST', body)
  }

  @Get(':id/projects')
  getProjects(@Param('id') id: string, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, `/workspaces/${id}/projects`)
  }

  @Post(':id/projects')
  createProject(@Param('id') id: string, @Body() body: unknown, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, `/workspaces/${id}/projects`, 'POST', body)
  }
}
