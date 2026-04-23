import { Module } from '@nestjs/common'
import { InspoController } from './inspo.controller'
import { InspoService } from './inspo.service'

@Module({
  controllers: [InspoController],
  providers: [InspoService],
  exports: [InspoService],
})
export class InspoModule {}
