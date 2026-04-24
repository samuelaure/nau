import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common'
import { BenchmarkService } from './benchmark.service'
import { GenerateCommentDto, CommentFeedbackDto } from './benchmark.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ServiceAuthGuard } from '../auth/service-auth.guard'

@Controller()
export class BenchmarkController {
  constructor(private readonly benchmarkService: BenchmarkService) {}

  @Post('brands/:brandId/generate-comment')
  @UseGuards(JwtAuthGuard)
  generateComments(@Param('brandId') brandId: string, @Body() dto: GenerateCommentDto) {
    return this.benchmarkService.generateComments(brandId, dto)
  }

  @Post('brands/:brandId/comment-feedback')
  @UseGuards(JwtAuthGuard)
  saveFeedback(@Param('brandId') brandId: string, @Body() dto: CommentFeedbackDto) {
    return this.benchmarkService.saveFeedback(brandId, dto)
  }

  @Get('brands/:brandId/comment-feedback')
  @UseGuards(JwtAuthGuard)
  listFeedback(@Param('brandId') brandId: string) {
    return this.benchmarkService.listFeedback(brandId)
  }

  @Get('brands/:brandId/synthesis')
  @UseGuards(JwtAuthGuard)
  listSyntheses(@Param('brandId') brandId: string) {
    return this.benchmarkService.listSyntheses(brandId)
  }

  @Get('brands/:brandId/synthesis/:type')
  @UseGuards(JwtAuthGuard)
  getSynthesis(@Param('brandId') brandId: string, @Param('type') type: string) {
    return this.benchmarkService.getSynthesis(brandId, type)
  }

  // Service routes
  @Post('_service/brands/:brandId/synthesis')
  @UseGuards(ServiceAuthGuard)
  upsertSynthesis(
    @Param('brandId') brandId: string,
    @Body() body: { type: string; content: string; attachedUrls?: string[] },
  ) {
    return this.benchmarkService.upsertSynthesis(brandId, body.type, body.content, body.attachedUrls)
  }

  @Post('_service/brands/:brandId/generate-comment')
  @UseGuards(ServiceAuthGuard)
  generateCommentsByService(@Param('brandId') brandId: string, @Body() dto: GenerateCommentDto) {
    return this.benchmarkService.generateComments(brandId, dto)
  }
}
