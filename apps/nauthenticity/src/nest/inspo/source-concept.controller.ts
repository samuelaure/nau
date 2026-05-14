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

  // User-facing: list pending concepts (freshness-filtered, for dashboard/debug)
  @Get('brands/:brandId/source-concepts')
  @UseGuards(JwtAuthGuard)
  listPending(@Param('brandId') brandId: string) {
    return this.sourceConceptService.listPending(brandId)
  }

  // Service-to-service: flownau gets concepts — returns pending pool or generates new if empty
  @Get('_service/brands/:brandId/source-concepts')
  @UseGuards(ServiceAuthGuard)
  getOrGenerateService(@Param('brandId') brandId: string) {
    return this.sourceConceptService.getOrGenerateForBrand(brandId)
  }

  // Service-to-service: explicit generation (bypasses dynamic serving, forces new generation)
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

  // User-facing: retroactively generate source concepts for already-synthesized INSPO posts
  @Post('brands/:brandId/source-concepts/retroactive')
  @UseGuards(JwtAuthGuard)
  generateRetroactive(@Param('brandId') brandId: string) {
    return this.sourceConceptService.generateRetroactiveForBrand(brandId)
  }
}
