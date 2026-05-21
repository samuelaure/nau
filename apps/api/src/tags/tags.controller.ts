import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import { IsOptional, IsString } from 'class-validator';

class CreateTagBody {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  parentId?: string | null;

  @IsString()
  @IsOptional()
  color?: string;
}

class UpdateTagBody {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  parentId?: string | null;

  @IsString()
  @IsOptional()
  color?: string | null;
}

@Controller()
@UseGuards(ServiceAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get('workspaces/:workspaceId/tags')
  list(@Param('workspaceId') workspaceId: string) {
    return this.tagsService.listForWorkspace(workspaceId);
  }

  @Post('workspaces/:workspaceId/tags')
  create(@Param('workspaceId') workspaceId: string, @Body() body: CreateTagBody) {
    return this.tagsService.create(workspaceId, body);
  }

  @Patch('tags/:id')
  update(@Param('id') id: string, @Body() body: UpdateTagBody) {
    return this.tagsService.update(id, body);
  }

  @Delete('tags/:id')
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }
}
