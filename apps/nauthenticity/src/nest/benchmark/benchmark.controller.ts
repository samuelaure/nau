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

  // Service routes
  @Post('_service/brands/:brandId/generate-comment')
  @UseGuards(ServiceAuthGuard)
  generateCommentsByService(@Param('brandId') brandId: string, @Body() dto: GenerateCommentDto) {
    return this.benchmarkService.generateComments(brandId, dto)
  }
}
