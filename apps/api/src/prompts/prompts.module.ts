import { Module } from '@nestjs/common';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [WorkspacesModule, PrismaModule],
  controllers: [PromptsController],
  providers: [PromptsService],
  exports: [PromptsService],
})
export class PromptsModule {}
