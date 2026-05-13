import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common'
import { InspoService } from './inspo.service'
import { CreateInspoMembershipDto, UpdateInspoMembershipDto } from './inspo.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ServiceAuthGuard } from '../auth/service-auth.guard'

@Controller()
export class InspoController {
  constructor(private readonly inspoService: InspoService) {}

  // User-facing routes
  @Post('brands/:brandId/inspo')
  @UseGuards(JwtAuthGuard)
  create(@Param('brandId') brandId: string, @Body() dto: CreateInspoMembershipDto) {
    return this.inspoService.create(brandId, dto)
  }

  @Get('brands/:brandId/inspo')
  @UseGuards(JwtAuthGuard)
  list(@Param('brandId') brandId: string) {
    return this.inspoService.list(brandId)
  }

  @Get('inspo/:id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.inspoService.findOne(id)
  }

  @Patch('brands/:brandId/inspo/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInspoMembershipDto,
  ) {
    return this.inspoService.update(id, brandId, dto)
  }

  @Delete('brands/:brandId/inspo/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('brandId') brandId: string, @Param('id') id: string) {
    return this.inspoService.delete(id, brandId)
  }

  @Post('brands/:brandId/inspo/by-url')
  @UseGuards(JwtAuthGuard)
  addByUrl(@Param('brandId') brandId: string, @Body() body: { postUrl?: string }) {
    if (!body.postUrl) throw new BadRequestException('postUrl is required')
    return this.inspoService.addByPostUrl(brandId, body.postUrl)
  }

  @Post('repost')
  @UseGuards(JwtAuthGuard)
  repost(@Body() body: { brandId?: string; postUrl?: string }) {
    if (!body.brandId || !body.postUrl) {
      throw new BadRequestException('Missing required fields: brandId, postUrl')
    }
    return this.inspoService.repost(body.brandId, body.postUrl)
  }

  // Service route (called by 9naŭ API / flownau)
  @Post('_service/brands/:brandId/inspo')
  @UseGuards(ServiceAuthGuard)
  createByService(@Param('brandId') brandId: string, @Body() dto: CreateInspoMembershipDto) {
    return this.inspoService.create(brandId, dto)
  }

  @Get('_service/brands/:brandId/inspo')
  @UseGuards(ServiceAuthGuard)
  listByService(@Param('brandId') brandId: string) {
    return this.inspoService.list(brandId)
  }

  @Patch('_service/brands/:brandId/inspo/:id')
  @UseGuards(ServiceAuthGuard)
  updateByService(
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInspoMembershipDto,
  ) {
    return this.inspoService.update(id, brandId, dto)
  }
}
