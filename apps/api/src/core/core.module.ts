import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { KindRegistryService } from './kinds/kind-registry.service';
import { ScopedPrismaService } from './tenancy/scoped-prisma.service';

/**
 * What `api` is once every module is switched off.
 *
 * Global because a relation must be able to reach the registry and the scoped
 * client without importing a chain of modules — and because there is exactly
 * one of each, by design. Two kind registries would mean two answers to who
 * owns a kind, which is the ambiguity this architecture exists to remove.
 *
 * The core imports no relation, and names none. That rule is enforced by
 * `src/boundaries.spec.ts` rather than trusted.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [KindRegistryService, ScopedPrismaService],
  exports: [KindRegistryService, ScopedPrismaService],
})
export class CoreModule {}
