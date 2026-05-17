import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import { ContentService } from './content.service'
import { ProfileSynthesisService } from './profile-synthesis.service'
import { AnyAuthGuard } from '../auth/any-auth.guard'

@Controller()
@UseGuards(AnyAuthGuard)
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly profileSynthesisService: ProfileSynthesisService,
  ) {}

  @Get('brands/:brandId/owned-profiles')
  getOwnedProfiles(@Param('brandId') brandId: string) {
    return this.contentService.getOwnedProfiles(brandId)
  }

  @Get('accounts')
  listAccounts(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.contentService.listAccounts(Number(page), Number(limit))
  }

  @Get('accounts/:username/export/txt')
  async exportTxt(@Param('username') username: string, @Res() res: Response) {
    const text = await this.contentService.exportAccountTxt(username)
    res
      .header('Content-Type', 'text/plain; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${username}_export.txt"`)
      .status(HttpStatus.OK)
      .send(text)
  }

  @Get('accounts/:username/progress')
  getProgress(@Param('username') username: string) {
    return this.contentService.getProgress(username)
  }

  @Get('accounts/:username')
  getAccount(@Param('username') username: string) {
    return this.contentService.getAccount(username)
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string) {
    return this.contentService.getPost(id)
  }

  @Put('posts/:id')
  updatePost(
    @Param('id') id: string,
    @Body() body: { caption?: string; transcriptText?: string; postSynthesis?: string },
  ) {
    return this.contentService.updatePost(id, body.caption, body.transcriptText, body.postSynthesis)
  }

  @Get('search')
  search(
    @Query('query') query?: string,
    @Query('username') username?: string,
    @Query('limit') limit = '10',
  ) {
    if (!query) throw new BadRequestException('Query is required')
    return this.contentService.search(query, username, Number(limit))
  }

  // POST /search also supported (original used POST with body)
  @Put('search')
  searchPost(@Body() body: { query?: string; username?: string; limit?: number }) {
    if (!body.query) throw new BadRequestException('Query is required')
    return this.contentService.search(body.query, body.username, body.limit ?? 10)
  }

  // ── Profile Synthesis ──────────────────────────────────────────────────────

  @Get('social-profiles/:id/synthesis')
  getProfileSynthesis(@Param('id') id: string) {
    return this.profileSynthesisService.getSynthesis(id)
  }

  @Post('social-profiles/:id/synthesis/generate')
  generateProfileSynthesis(@Param('id') id: string) {
    return this.profileSynthesisService.generateForProfile(id)
  }

  @Post('social-profiles/:id/intelligence/generate')
  generateProfileIntelligence(@Param('id') id: string, @Body() body: { brandId: string }) {
    return this.profileSynthesisService.generateIntelligence(id, body.brandId)
  }

  @Patch('social-profiles/:id/synthesis/threshold')
  updateSynthesisThreshold(
    @Param('id') id: string,
    @Body() body: { threshold: number },
  ) {
    return this.profileSynthesisService.updateThreshold(id, body.threshold)
  }
}
