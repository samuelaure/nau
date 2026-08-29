import { Controller, Post, Body, Delete, Param, UseGuards } from '@nestjs/common';
import { GraphService } from './graph.service';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

@Controller('relations')
@UseGuards(JwtAuthGuard)
export class GraphController {
  constructor(private readonly relationsService: GraphService) {}

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body()
    dto: {
      fromBlockId: string;
      toBlockId: string;
      type: string;
      properties?: Record<string, unknown>;
    },
  ) {
    return this.relationsService.create(
      user.sub,
      dto.fromBlockId,
      dto.toBlockId,
      dto.type,
      dto.properties,
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.relationsService.remove(user.sub, id);
  }
}
