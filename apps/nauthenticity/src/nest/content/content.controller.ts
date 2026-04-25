import {
  Controller,
  Get,
  Put,
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
import { AnyAuthGuard } from '../auth/any-auth.guard'

@Controller()
@UseGuards(AnyAuthGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

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
    @Body() body: { caption?: string; transcriptText?: string },
  ) {
    return this.contentService.updatePost(id, body.caption, body.transcriptText)
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
}
