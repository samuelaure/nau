import { Module } from '@nestjs/common';
import { JournalService } from './journal.service';
import { JournalController } from './journal.controller';
import { JournalReadController } from './journal-read.controller';
import { JournalZazuController } from './journal-zazu.controller';
import { JournalReadService } from './journal-read.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * `ScopedPrismaService` (what `JournalService` and `JournalReadService` depend
 * on) comes from `CoreModule`, which is `@Global()` — nothing to import here
 * for it. `BlocksModule` is not needed any more (nau#92): the domain writes
 * reach the substrate through the scope, not through a service outside this
 * relation.
 *
 * `PrismaModule` *is* needed, for `JournalZazuController` alone: resolving a
 * caller's workspace from a bare Telegram id (nau#130) has no workspace to
 * scope by yet — that is the one query this relation runs directly, before a
 * scope exists to hand to `ScopedPrismaService`.
 */
@Module({
  imports: [PrismaModule],
  controllers: [JournalController, JournalReadController, JournalZazuController],
  providers: [JournalService, JournalReadService],
  exports: [JournalService, JournalReadService],
})
export class JournalModule {}
