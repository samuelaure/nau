import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { InspoService } from './inspo.service'
import { CreateInspoItemDto, UpdateInspoItemDto } from './inspo.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ServiceAuthGuard } from '../auth/service-auth.guard'

@Controller()
export class InspoController {
  constructor(private readonly inspoService: InspoService) {}

  // User-facing routes
  @Post('brands/:brandId/inspo')
  @UseGuards(JwtAuthGuard)
  create(@Param('brandId') brandId: string, @Body() dto: CreateInspoItemDto) {
    return this.inspoService.create(brandId, dto)
  }

  @Get('brands/:brandId/inspo')
  @UseGuards(JwtAuthGuard)
  list(
    @Param('brandId') brandId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.inspoService.list(brandId, { type, status })
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
    @Body() dto: UpdateInspoItemDto,
  ) {
    return this.inspoService.update(id, brandId, dto)
  }

  @Delete('brands/:brandId/inspo/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('brandId') brandId: string, @Param('id') id: string) {
    return this.inspoService.delete(id, brandId)
  }

  @Get('brands/:brandId/inspo/digest')
  @UseGuards(JwtAuthGuard)
  digest(@Param('brandId') brandId: string) {
    return this.inspoService.digest(brandId)
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
  createByService(@Param('brandId') brandId: string, @Body() dto: CreateInspoItemDto) {
    return this.inspoService.create(brandId, dto)
  }

  @Get('_service/brands/:brandId/inspo')
  @UseGuards(ServiceAuthGuard)
  listByService(
    @Param('brandId') brandId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.inspoService.list(brandId, { type, status })
  }

  @Get('_service/brands/:brandId/inspo/digest')
  @UseGuards(ServiceAuthGuard)
  digestByService(@Param('brandId') brandId: string) {
    return this.inspoService.digest(brandId)
  }

  @Patch('_service/brands/:brandId/inspo/:id')
  @UseGuards(ServiceAuthGuard)
  updateByService(
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInspoItemDto,
  ) {
    return this.inspoService.update(id, brandId, dto)
  }
}
