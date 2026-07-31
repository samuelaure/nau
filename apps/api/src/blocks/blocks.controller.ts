import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';
import { FindBlocksQueryDto } from './dto/find-blocks-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() createBlockDto: CreateBlockDto,
  ) {
    return this.blocksService.create(user, createBlockDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: FindBlocksQueryDto,
  ) {
    return this.blocksService.findAll(user.sub, query);
  }

  @Get('remindable')
  getRemindableBlocks(@CurrentUser() user: AccessTokenPayload) {
    return this.blocksService.getRemindableBlocks(user.sub);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.blocksService.findOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() updateBlockDto: UpdateBlockDto,
  ) {
    return this.blocksService.update(user.sub, id, updateBlockDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.blocksService.remove(user.sub, id);
  }

  @Post(':id/tags')
  addTag(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body('tagId') tagId: string,
  ) {
    return this.blocksService.addTag(user.sub, id, tagId);
  }

  @Delete(':id/tags/:tagId')
  removeTag(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    return this.blocksService.removeTag(user.sub, id, tagId);
  }
}
