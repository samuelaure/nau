import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InspoController } from './inspo.controller'
import { InspoService } from './inspo.service'
import { SourceConceptController } from './source-concept.controller'
import { SourceConceptService } from './source-concept.service'
import { VoicenoteController } from './voicenote.controller'
import { VoicenoteService } from './voicenote.service'
import { BrandSettingsController } from './brand-settings.controller'

@Module({
  imports: [ConfigModule],
  controllers: [InspoController, SourceConceptController, VoicenoteController, BrandSettingsController],
  providers: [InspoService, SourceConceptService, VoicenoteService],
  exports: [InspoService, SourceConceptService, VoicenoteService],
})
export class InspoModule {}
