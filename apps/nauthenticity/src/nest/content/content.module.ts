import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ContentController } from './content.controller'
import { PublishingController } from './publishing.controller'
import { SocialProfilesController } from './social-profiles.controller'
import { ContentService } from './content.service'
import { ProfileSynthesisService } from './profile-synthesis.service'
import { FlownauSyncService } from '../../modules/sync/flownau-sync.service'

@Module({
  imports: [ConfigModule],
  controllers: [ContentController, PublishingController, SocialProfilesController],
  providers: [ContentService, ProfileSynthesisService, FlownauSyncService],
  exports: [ProfileSynthesisService],
})
export class ContentModule {}
