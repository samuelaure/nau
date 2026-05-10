import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InspoController } from './inspo.controller'
import { InspoService } from './inspo.service'
import { SourceConceptController } from './source-concept.controller'
import { SourceConceptService } from './source-concept.service'
import { VoicenoteController } from './voicenote.controller'
import { VoicenoteService } from './voicenote.service'

@Module({
  imports: [ConfigModule],
  controllers: [InspoController, SourceConceptController, VoicenoteController],
  providers: [InspoService, SourceConceptService, VoicenoteService],
  exports: [InspoService, SourceConceptService, VoicenoteService],
})
export class InspoModule {}
