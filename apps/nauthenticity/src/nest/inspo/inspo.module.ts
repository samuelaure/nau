import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InspoController } from './inspo.controller'
import { InspoService } from './inspo.service'
import { SourceConceptController } from './source-concept.controller'
import { SourceConceptService } from './source-concept.service'

@Module({
  imports: [ConfigModule],
  controllers: [InspoController, SourceConceptController],
  providers: [InspoService, SourceConceptService],
  exports: [InspoService, SourceConceptService],
})
export class InspoModule {}
