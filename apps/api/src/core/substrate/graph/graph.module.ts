import { Module } from '@nestjs/common';
import { GraphController } from './graph.controller';
import { GraphService } from './graph.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { BlocksModule } from '../../../blocks/blocks.module';

@Module({
  imports: [PrismaModule, BlocksModule],
  controllers: [GraphController],
  providers: [GraphService],
})
export class GraphModule {}
