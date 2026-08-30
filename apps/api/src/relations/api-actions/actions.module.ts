import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';

/**
 * `ScopedPrismaService` and `SubstrateService` come from `CoreModule`, which
 * is `@Global()` — nothing to import here for either, same pattern
 * `ReferencesModule` and `JournalModule` already follow post-nau#92.
 *
 * Deliberately its own module, not folded into `AgendaModule`: this CRUD
 * never touches `Planning`, `PrismaService`, or `BlocksService` — the
 * dependencies `AgendaModule` still carries from the pre-rebuild agenda
 * (nau#64). Splitting them means this module's own `boundaries.spec.ts`
 * check (`PrismaService has an owner`) has nothing to flag here at all.
 */
@Module({
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
