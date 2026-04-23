import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common'
import { ScrapingService } from './scraping.service'
import { StartScrapingDto, IngestPostsDto } from './scraping.dto'
import { ServiceAuthGuard } from '../auth/service-auth.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller()
export class ScrapingController {
  constructor(private readonly scrapingService: ScrapingService) {}

  @Post('_service/scraping/runs')
  @UseGuards(ServiceAuthGuard)
  startRun(@Body() dto: StartScrapingDto) {
    return this.scrapingService.startRun(dto)
  }

  @Post('_service/scraping/ingest')
  @UseGuards(ServiceAuthGuard)
  ingestPosts(@Body() dto: IngestPostsDto) {
    return this.scrapingService.ingestPosts(dto)
  }

  @Get('brands/:brandId/scraping/runs')
  @UseGuards(JwtAuthGuard)
  listRuns(@Param('brandId') brandId: string) {
    return this.scrapingService.listRuns(brandId)
  }

  @Get('scraping/runs/:id')
  @UseGuards(JwtAuthGuard)
  getRun(@Param('id') id: string) {
    return this.scrapingService.getRun(id)
  }
}
