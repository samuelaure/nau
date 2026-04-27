import { Module } from '@nestjs/common'
import { ContentController } from './content.controller'
import { PublishingController } from './publishing.controller'
import { SocialProfilesController } from './social-profiles.controller'
import { ContentService } from './content.service'
import { FlownauSyncService } from '../../modules/sync/flownau-sync.service'

@Module({
  controllers: [ContentController, PublishingController, SocialProfilesController],
  providers: [ContentService, FlownauSyncService],
})
export class ContentModule {}
