import { Module } from '@nestjs/common';
import { GtdController } from './gtd.controller';
import { GtdService } from './gtd.service';
import { EventsModule } from '../../core/substrate/events/events.module';

/**
 * `(api)·(GTD)`. Depends on `EventsModule` for the movement log and reaches
 * `SubstrateService`/`ScopedPrismaService` through `CoreModule`'s `@Global`
 * export, same as every other relation.
 */
@Module({
  imports: [EventsModule],
  controllers: [GtdController],
  providers: [GtdService],
  exports: [GtdService],
})
export class GtdModule {}
