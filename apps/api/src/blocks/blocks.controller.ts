import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';
import { FindBlocksQueryDto } from './dto/find-blocks-query.dto';

@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post()
  create(@Body() createBlockDto: CreateBlockDto) {
    return this.blocksService.create(createBlockDto);
  }

  @Get()
  findAll(@Query() query: FindBlocksQueryDto) {
    return this.blocksService.findAll(query);
  }

  @Get('remindable')
  getRemindableBlocks() {
    return this.blocksService.getRemindableBlocks();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.blocksService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBlockDto: UpdateBlockDto) {
    return this.blocksService.update(id, updateBlockDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blocksService.remove(id);
  }

  @Post(':id/tags')
  addTag(@Param('id') id: string, @Body('tagId') tagId: string) {
    return this.blocksService.addTag(id, tagId);
  }

  @Delete(':id/tags/:tagId')
  removeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.blocksService.removeTag(id, tagId);
  }
}
