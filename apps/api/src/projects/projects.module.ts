import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [PrismaModule, WorkspacesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
