import { Module, OnModuleInit } from '@nestjs/common';
import { KindRegistryService } from '../../core/kinds/kind-registry.service';
import { JOURNAL_KINDS } from './journal.kinds';

/**
 * Registers Journal's kinds with the core at startup.
 *
 * Separate from the existing `JournalModule` on purpose: that module is the
 * service and controller as they are today, still to be moved here (nau#79).
 * Registration is the part that can land first and independently, because it
 * changes nothing about how Journal currently behaves — it only tells the core
 * what a `journal.entry` is.
 *
 * The whole of Journal's presence in the core is this file plus the two it
 * imports. Deleting the folder unregisters the kinds and touches nothing else.
 */
@Module({})
export class JournalKindsModule implements OnModuleInit {
  constructor(private readonly registry: KindRegistryService) {}

  onModuleInit() {
    for (const kind of JOURNAL_KINDS) {
      this.registry.register(kind);
    }
  }
}
