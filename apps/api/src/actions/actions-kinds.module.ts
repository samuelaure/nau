import { Module, OnModuleInit } from '@nestjs/common';
import { KindRegistryService } from '../core/kinds/kind-registry.service';
import { ACTIONS_KINDS } from './actions.kinds';

/**
 * Registers Actions' kind with the core at startup.
 *
 * Separate from `AgendaModule`, same split `JournalKindsModule` and
 * `ReferencesKindsModule` established: registration changes nothing about
 * how Actions behaves — it only tells the core what an `actions.item` is.
 *
 * The whole of Actions' presence in the core is this file plus the one it
 * imports. Deleting the folder unregisters the kind and touches nothing
 * else.
 */
@Module({})
export class ActionsKindsModule implements OnModuleInit {
  constructor(private readonly registry: KindRegistryService) {}

  onModuleInit() {
    for (const kind of ACTIONS_KINDS) {
      this.registry.register(kind);
    }
  }
}
