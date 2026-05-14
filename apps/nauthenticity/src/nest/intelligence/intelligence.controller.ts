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
import { IntelligenceService, isCategory, type Category } from './intelligence.service'
import { AnyAuthGuard } from '../auth/any-auth.guard'

@Controller()
@UseGuards(AnyAuthGuard)
export class IntelligenceController {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  // -------------------------------------------------------------------------
  // Brand Intelligence
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
    @Body() body: { workspaceId?: string; mainUsername?: string },
  ) {
    return this.intelligenceService.syncServiceBrand(brandId, body)
  }

  // -------------------------------------------------------------------------
  // Memberships (URL kept as `/targets` for now — internal name is "membership")
  // category: 'COMMENT' | 'INSPO' | 'BENCHMARK'
  // -------------------------------------------------------------------------

  @Get('targets')
  getProfileMemberships(
    @Query('brandId') brandId?: string,
    @Query('projectId') projectId?: string,
    @Query('category') category?: string,
  ) {
    if (!brandId && !projectId) throw new BadRequestException('Missing brandId or projectId')
    if (category !== undefined && !isCategory(category)) {
      throw new BadRequestException(`Invalid category. Expected one of COMMENT, INSPO, BENCHMARK`)
    }
    const owner = brandId ? { brandId } : { projectId: projectId! }
    return this.intelligenceService.getProfileMemberships(owner, category as Category | undefined)
  }

  @Post('targets')
  createProfileMemberships(
    @Body()
    body: {
      brandId?: string
      projectId?: string
      usernames?: string[]
      category?: string
      isActive?: boolean
    },
  ) {
    if (!body.brandId && !body.projectId) {
      throw new BadRequestException('brandId or projectId is required')
    }
    if (!body.usernames?.length) {
      throw new BadRequestException('usernames are required')
    }
    if (!body.category || !isCategory(body.category)) {
      throw new BadRequestException(`Missing or invalid category. Expected one of COMMENT, INSPO, BENCHMARK`)
    }
    const owner = body.brandId ? { brandId: body.brandId } : { projectId: body.projectId! }
    return this.intelligenceService.createProfileMemberships(owner, body.usernames, {
      category: body.category as Category,
      isActive: body.isActive,
    })
  }

  @Put('targets/:id')
  updateMembership(
    @Param('id') id: string,
    @Body() body: { isActive?: boolean; category?: string },
  ) {
    if (body.category !== undefined && !isCategory(body.category)) {
      throw new BadRequestException(`Invalid category. Expected one of COMMENT, INSPO, BENCHMARK`)
    }
    return this.intelligenceService.updateMembership(id, {
      isActive: body.isActive,
      category: body.category as Category | undefined,
    })
  }

  @Patch('targets/:id')
  patchMembership(
    @Param('id') id: string,
    @Body() body: { isActive?: boolean; category?: string },
  ) {
    if (body.category !== undefined && !isCategory(body.category)) {
      throw new BadRequestException(`Invalid category. Expected one of COMMENT, INSPO, BENCHMARK`)
    }
    return this.intelligenceService.updateMembership(id, {
      isActive: body.isActive,
      category: body.category as Category | undefined,
    })
  }

  @Delete('targets')
  deleteMembership(@Query('id') id?: string, @Query('action') action?: string) {
    if (!id) throw new BadRequestException('Missing membership id')
    const resolvedAction = action === 'remove' ? 'remove' : 'benchmark'
    return this.intelligenceService.deleteMembership(id, resolvedAction)
  }

  // -------------------------------------------------------------------------
  // Trash
  // -------------------------------------------------------------------------

  @Get('trash')
  getTrashItems(@Query('brandId') brandId?: string) {
    if (!brandId) throw new BadRequestException('Missing brandId')
    return this.intelligenceService.getTrashItems(brandId)
  }

  @Post('trash/:id/restore')
  restoreTrashItem(@Param('id') id: string) {
    return this.intelligenceService.restoreTrashItem(id)
  }

  @Delete('trash/:id')
  permanentlyDeleteTrashItem(@Param('id') id: string) {
    return this.intelligenceService.permanentlyDeleteTrashItem(id)
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

  // -------------------------------------------------------------------------
  // Individual post capture (dedup-aware)
  // Checks if the post already exists; if so, only creates the membership link.
  // -------------------------------------------------------------------------

  @Post('capture-post')
  capturePost(
    @Body()
    body: {
      postUrl?: string
      brandId?: string
      projectId?: string
      category?: string
    },
  ) {
    if (!body.postUrl) throw new BadRequestException('postUrl is required')
    if (!body.brandId && !body.projectId) throw new BadRequestException('brandId or projectId is required')
    if (!body.category || !isCategory(body.category)) {
      throw new BadRequestException('Missing or invalid category. Expected one of COMMENT, INSPO, BENCHMARK')
    }
    const owner = body.brandId ? { brandId: body.brandId } : { projectId: body.projectId! }
    return this.intelligenceService.capturePost(owner, body.postUrl, body.category as Category)
  }
}
