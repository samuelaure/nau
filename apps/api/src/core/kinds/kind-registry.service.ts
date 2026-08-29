import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BlockKind, KIND_ID_PATTERN, ownerOf } from './kind.contract';

/**
 * The set of block kinds the running system knows, assembled at startup from
 * whichever relations are mounted.
 *
 * The registry is a mechanism. It contains no kind of its own and names none:
 * switch every module off and this class still compiles, still runs, and simply
 * knows nothing — which is the definition `api` is built to
 * (`api` is what remains when every module is switched off).
 *
 * That is what makes a module removable. Deleting a relation unregisters its
 * kinds; the core does not change, the database schema does not change, and
 * there is no migration to write.
 */
@Injectable()
export class KindRegistryService {
  private readonly logger = new Logger(KindRegistryService.name);
  private readonly kinds = new Map<string, BlockKind>();

  /**
   * Called by a relation's module at startup, once per kind it owns.
   *
   * Registration is deliberately strict — a malformed id or a duplicate throws
   * rather than warns. A registry that tolerates two owners for one kind has
   * the same failure the vocabulary drift had: no single answer to "who owns
   * this", discovered later and by inspection.
   */
  register<T>(kind: BlockKind<T>): void {
    if (!KIND_ID_PATTERN.test(kind.id)) {
      throw new Error(
        `Invalid kind id "${kind.id}": expected "<owner>.<name>", lowercase, e.g. "example.thing"`,
      );
    }

    const existing = this.kinds.get(kind.id);
    if (existing) {
      throw new Error(
        `Kind "${kind.id}" is already registered. A kind has exactly one owner; ` +
          `two registrations mean two modules claim it.`,
      );
    }

    this.kinds.set(kind.id, kind as BlockKind);
    // Debug rather than log: registration happens once per kind at startup and
    // is worth having when a relation fails to mount, but at log level it
    // buries real output in any suite that builds a registry per test.
    this.logger.debug(`Registered kind ${kind.id} (owner: ${ownerOf(kind.id)})`);
  }

  /** Every registered kind. Order is registration order. */
  all(): readonly BlockKind[] {
    return [...this.kinds.values()];
  }

  /** Kinds owned by one module — the whole surface a relation contributed. */
  ownedBy(owner: string): readonly BlockKind[] {
    return this.all().filter((kind) => ownerOf(kind.id) === owner);
  }

  /**
   * Kinds that declare a capability.
   *
   * This is the call that replaces a consumer holding a hardcoded list of other
   * modules' types. Ask for what you need — `withCapability('schedulable')` —
   * and a kind registered later is included without this caller changing.
   */
  withCapability(capability: keyof BlockKind['capabilities']): readonly BlockKind[] {
    return this.all().filter((kind) => kind.capabilities[capability]);
  }

  has(kindId: string): boolean {
    return this.kinds.has(kindId);
  }

  /** Throws if the kind is unknown — an unregistered kind is never a default. */
  get(kindId: string): BlockKind {
    const kind = this.kinds.get(kindId);
    if (!kind) {
      throw new BadRequestException(`Unknown block kind "${kindId}"`);
    }
    return kind;
  }

  /**
   * Validates a properties payload against its kind's schema.
   *
   * Every write to the substrate goes through here. This is the single point
   * where "the JSON matches what its owner says it is" stops being a hope.
   */
  validate(kindId: string, properties: unknown): unknown {
    const kind = this.get(kindId);
    const result = kind.schema.safeParse(properties);

    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new BadRequestException(`Invalid properties for kind "${kindId}" — ${detail}`);
    }

    return result.data;
  }

  /** Asserts a kind supports something before the substrate acts on it. */
  assertCapability(kindId: string, capability: keyof BlockKind['capabilities']): void {
    const kind = this.get(kindId);
    if (!kind.capabilities[capability]) {
      throw new BadRequestException(`Kind "${kindId}" does not support "${capability}"`);
    }
  }
}
