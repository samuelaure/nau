import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AnyAuthGuard } from '../auth/any-auth.guard'
import { COOKIE_ACCESS_TOKEN } from '@nau/auth'

const CENTRAL_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'

@Controller('workspaces')
@UseGuards(AnyAuthGuard)
export class WorkspacesController {
  constructor(private readonly config: ConfigService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async proxy(req: any, res: any, endpoint: string, method = 'GET', body?: unknown) {
    const cookieToken = req.cookies?.[COOKIE_ACCESS_TOKEN]
    const bearerToken = req.headers['authorization']?.replace('Bearer ', '')
    const token = cookieToken ?? bearerToken

    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Unauthorized' })
      return
    }

    try {
      const fetchRes = await fetch(`${CENTRAL_API_URL}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: method !== 'GET' && method !== 'DELETE' ? JSON.stringify(body) : undefined,
      })
      const data = await fetchRes.json().catch(() => ({}))
      res.status(fetchRes.status).json(data)
    } catch {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Proxy failed' })
    }
  }

  @Get()
  list(@Req() req: unknown, @Res() res: unknown) {
    return this.proxy(req, res, '/workspaces')
  }

  @Post()
  create(@Body() body: unknown, @Req() req: unknown, @Res() res: unknown) {
    return this.proxy(req, res, '/workspaces', 'POST', body)
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string, @Req() req: unknown, @Res() res: unknown) {
    return this.proxy(req, res, `/workspaces/${id}/members`)
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() body: unknown, @Req() req: unknown, @Res() res: unknown) {
    return this.proxy(req, res, `/workspaces/${id}`, 'PATCH', body)
  }

  @Put(':id/members/:userId')
  updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() req: unknown,
    @Res() res: unknown,
  ) {
    return this.proxy(req, res, `/workspaces/${id}/members/${userId}`, 'PUT', body)
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: unknown, @Req() req: unknown, @Res() res: unknown) {
    return this.proxy(req, res, `/workspaces/${id}/members`, 'POST', body)
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: unknown,
    @Res() res: unknown,
  ) {
    return this.proxy(req, res, `/workspaces/${id}/members/${userId}`, 'DELETE')
  }

  @Get(':id/brands')
  getBrands(@Param('id') id: string, @Req() req: unknown, @Res() res: unknown) {
    return this.proxy(req, res, `/workspaces/${id}/brands`)
  }

  @Post(':id/brands')
  createBrand(@Param('id') id: string, @Body() body: unknown, @Req() req: unknown, @Res() res: unknown) {
    return this.proxy(req, res, `/workspaces/${id}/brands`, 'POST', body)
  }
}
