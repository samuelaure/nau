import { Module } from '@nestjs/common';
import { ReferencesService } from './references.service';
import { ReferencesController } from './references.controller';

/**
 * `ScopedPrismaService` and `SubstrateService` come from `CoreModule`, which
 * is `@Global()` — nothing to import here for either. This relation reaches
 * the substrate through the scope and the registry, never through a service
 * outside itself, same discipline `JournalModule` follows post-nau#92.
 */
@Module({
  controllers: [ReferencesController],
  providers: [ReferencesService],
  exports: [ReferencesService],
})
export class ReferencesModule {}
