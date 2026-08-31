import { Module } from '@nestjs/common';
import { GtdController } from './gtd.controller';
import { GtdZazuController } from './gtd-zazu.controller';
import { GtdService } from './gtd.service';
import { GtdTriageService } from './gtd-triage.service';
import { EventsModule } from '../core/substrate/events/events.module';
import { BlocksModule } from '../blocks/blocks.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * `(api)·(GTD)`. Depends on `EventsModule` for the movement log and reaches
 * `SubstrateService`/`ScopedPrismaService` through `CoreModule`'s `@Global`
 * export, same as every other relation.
 */
@Module({
  imports: [EventsModule, BlocksModule, IntegrationsModule, PrismaModule],
  controllers: [GtdController, GtdZazuController],
  providers: [GtdService, GtdTriageService],
  exports: [GtdService, GtdTriageService],
})
export class GtdModule {}
