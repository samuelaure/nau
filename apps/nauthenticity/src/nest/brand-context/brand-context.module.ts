import { Module } from '@nestjs/common'
import { BrandContextController } from './brand-context.controller'
import { BrandContextService } from './brand-context.service'

@Module({
  controllers: [BrandContextController],
  providers: [BrandContextService],
  exports: [BrandContextService],
})
export class BrandContextModule {}
