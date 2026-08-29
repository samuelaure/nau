import { Module } from '@nestjs/common';
import { JournalService } from './journal.service';
import { JournalController } from './journal.controller';
import { JournalReadController } from './journal-read.controller';
import { JournalReadService } from './journal-read.service';

/**
 * `ScopedPrismaService` (what both services below actually depend on) comes
 * from `CoreModule`, which is `@Global()` — nothing to import here for it.
 * Neither `BlocksModule` nor `PrismaModule` is needed any more (nau#92):
 * Journal reaches the substrate through the scope, not through a service
 * outside this relation.
 */
@Module({
  controllers: [JournalController, JournalReadController],
  providers: [JournalService, JournalReadService],
  exports: [JournalService, JournalReadService],
})
export class JournalModule {}
