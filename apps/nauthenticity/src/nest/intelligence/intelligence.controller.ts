import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { IntelligenceService } from './intelligence.service'
import { AnyAuthGuard } from '../auth/any-auth.guard'

@Controller()
@UseGuards(AnyAuthGuard)
export class IntelligenceController {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  // -------------------------------------------------------------------------
  // BrandIntelligence
  // -------------------------------------------------------------------------

  @Get('brands/:brandId/intelligence')
  getIntelligence(@Param('brandId') brandId: string) {
    return this.intelligenceService.getIntelligence(brandId)
  }

  @Put('brands/:brandId/intelligence')
  upsertIntelligence(@Param('brandId') brandId: string, @Body() body: Record<string, unknown>) {
    return this.intelligenceService.upsertIntelligence(brandId, body)
  }

  @Patch('brands/:brandId/intelligence')
  patchIntelligence(@Param('brandId') brandId: string, @Body() body: Record<string, unknown>) {
    return this.intelligenceService.upsertIntelligence(brandId, body)
  }

  // -------------------------------------------------------------------------
  // DNA
  // -------------------------------------------------------------------------

  @Get('brands/:brandId/dna')
  getDna(@Param('brandId') brandId: string) {
    return this.intelligenceService.getDna(brandId)
  }

  @Get('brands/:brandId/dna-light')
  getDnaLight(@Param('brandId') brandId: string) {
    return this.intelligenceService.getDnaLight(brandId)
  }

  // -------------------------------------------------------------------------
  // Service-to-service
  // -------------------------------------------------------------------------

  @Get('service/brands')
  listServiceBrands(@Query('workspaceId') workspaceId?: string) {
    if (!workspaceId) throw new BadRequestException('Missing workspaceId')
    return this.intelligenceService.listServiceBrands(workspaceId)
  }

  @Patch('service/brands/:brandId')
  syncServiceBrand(
    @Param('brandId') brandId: string,
    @Body() body: { workspaceId?: string; mainIgUsername?: string },
  ) {
    return this.intelligenceService.syncServiceBrand(brandId, body)
  }

  // -------------------------------------------------------------------------
  // Targets
  // -------------------------------------------------------------------------

  @Get('targets')
  getTargets(@Query('brandId') brandId?: string, @Query('targetType') targetType?: string) {
    if (!brandId) throw new BadRequestException('Missing brandId')
    return this.intelligenceService.getTargets(brandId, targetType)
  }

  @Post('targets')
  createTargets(
    @Body()
    body: {
      brandId?: string
      usernames?: string[]
      targetType?: string
      profileStrategy?: string
      isActive?: boolean
      initialDownloadCount?: number
      autoUpdate?: boolean
    },
  ) {
    if (!body.brandId || !body.usernames?.length) {
      throw new BadRequestException('brandId and usernames are required')
    }
    return this.intelligenceService.createTargets(body.brandId, body.usernames, body)
  }

  @Put('targets/:brandId/:username')
  updateTarget(
    @Param('brandId') brandId: string,
    @Param('username') username: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.intelligenceService.updateTarget(brandId, username, body)
  }

  @Patch('targets/:id')
  patchTarget(
    @Param('id') id: string,
    @Body() body: { isActive?: boolean; autoUpdate?: boolean; initialDownloadCount?: number },
  ) {
    return this.intelligenceService.patchTarget(id, body)
  }

  @Delete('targets')
  deleteTarget(@Query('brandId') brandId?: string, @Query('username') username?: string) {
    if (!brandId || !username) throw new BadRequestException('Missing brandId or username')
    return this.intelligenceService.deleteTarget(brandId, username)
  }

  // -------------------------------------------------------------------------
  // Reactive comment generation and feedback
  // -------------------------------------------------------------------------

  @Post('generate-comment')
  generateComment(@Body() body: { targetUrl?: string; brandId?: string }) {
    if (!body.targetUrl || !body.brandId) {
      throw new BadRequestException('Missing required fields: targetUrl and brandId')
    }
    return this.intelligenceService.generateComment(body.targetUrl, body.brandId)
  }

  @Post('comment-feedback')
  commentFeedback(
    @Body()
    body: {
      commentText?: string
      brandId?: string
      sourcePostId?: string
      isSelected?: boolean
    },
  ) {
    if (!body.commentText || !body.brandId || !body.sourcePostId) {
      throw new BadRequestException('Missing required fields')
    }
    return this.intelligenceService.commentFeedback(
      body.brandId,
      body.sourcePostId,
      body.commentText,
      body.isSelected ?? false,
    )
  }

  @Post('trigger-fanout')
  triggerFanout() {
    return this.intelligenceService.triggerFanout()
  }
}
