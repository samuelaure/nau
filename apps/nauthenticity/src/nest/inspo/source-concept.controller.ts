import { Controller, Get, Post, Patch, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { SourceConceptService } from './source-concept.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ServiceAuthGuard } from '../auth/service-auth.guard'

@Controller()
export class SourceConceptController {
  constructor(private readonly sourceConceptService: SourceConceptService) {}

  // User-facing: trigger generation from InspoBase
  @Post('brands/:brandId/source-concepts/generate')
  @UseGuards(JwtAuthGuard)
  generate(@Param('brandId') brandId: string) {
    return this.sourceConceptService.generateFromInspoBase(brandId)
  }

  // User-facing: list pending concepts
  @Get('brands/:brandId/source-concepts')
  @UseGuards(JwtAuthGuard)
  listPending(@Param('brandId') brandId: string) {
    return this.sourceConceptService.listPending(brandId)
  }

  // Service-to-service: flownau pulls pending concepts
  @Get('_service/brands/:brandId/source-concepts')
  @UseGuards(ServiceAuthGuard)
  listPendingService(@Param('brandId') brandId: string) {
    return this.sourceConceptService.listPending(brandId)
  }

  // Service-to-service: flownau triggers generation
  @Post('_service/brands/:brandId/source-concepts/generate')
  @UseGuards(ServiceAuthGuard)
  generateService(@Param('brandId') brandId: string) {
    return this.sourceConceptService.generateFromInspoBase(brandId)
  }

  // Service-to-service: flownau marks a concept consumed after generating ideas from it
  @Patch('_service/source-concepts/:id/consume')
  @UseGuards(ServiceAuthGuard)
  @HttpCode(HttpStatus.OK)
  consumeService(@Param('id') id: string) {
    return this.sourceConceptService.markConsumed(id)
  }
}
