import { Controller, Get, Patch, Delete, Param, Body, Req, Res, UseGuards } from '@nestjs/common'
import { AnyAuthGuard } from '../auth/any-auth.guard'
import { proxyToApi } from './api-proxy'

@Controller('projects')
@UseGuards(AnyAuthGuard)
export class ProjectsProxyController {
  @Get(':id')
  getOne(@Param('id') id: string, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, `/projects/${id}`)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, `/projects/${id}`, 'PATCH', body)
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: unknown, @Res() res: unknown) {
    return proxyToApi(req, res, `/projects/${id}`, 'DELETE')
  }
}
