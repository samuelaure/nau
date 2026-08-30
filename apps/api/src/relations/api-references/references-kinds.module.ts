import { Module, OnModuleInit } from '@nestjs/common';
import { KindRegistryService } from '../../core/kinds/kind-registry.service';
import { REFERENCES_KINDS } from './references.kinds';

/**
 * Registers References' kinds with the core at startup.
 *
 * Separate from `ReferencesModule` (service and controller), same split
 * `JournalKindsModule` established: registration changes nothing about how
 * References behaves — it only tells the core what a `references.note` is.
 *
 * The whole of References' presence in the core is this file plus the one
 * it imports. Deleting the folder unregisters the kind and touches nothing
 * else.
 */
@Module({})
export class ReferencesKindsModule implements OnModuleInit {
  constructor(private readonly registry: KindRegistryService) {}

  onModuleInit() {
    for (const kind of REFERENCES_KINDS) {
      this.registry.register(kind);
    }
  }
}
