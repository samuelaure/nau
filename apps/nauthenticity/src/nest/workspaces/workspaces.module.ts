import { Module } from '@nestjs/common'
import { WorkspacesController } from './workspaces.controller'
import { ProjectsProxyController } from './projects-proxy.controller'

@Module({
  controllers: [WorkspacesController, ProjectsProxyController],
})
export class WorkspacesModule {}
