import type { Scale, ScaleId, SystemId, TimeSystem } from './contract';

/**
 * Which time systems exist, and how to reach one by id.
 *
 * A registry rather than a union type or a switch, because a workspace runs
 * several systems at once and the set is meant to grow: Gregorian now, then naŭ,
 * ephemeris and triggers. Adding one is a registration, not an edit to
 * everything that consumes a system.
 *
 * The core still knows nothing about any particular system — it only knows they
 * implement `TimeSystem`. Nothing in `core/` imports from `systems/`; the
 * composition happens where the application is wired.
 */
export class SystemRegistry {
  private readonly systems = new Map<SystemId, TimeSystem>();

  constructor(systems: readonly TimeSystem[] = []) {
    for (const system of systems) this.register(system);
  }

  register(system: TimeSystem): void {
    if (this.systems.has(system.id)) {
      throw new Error(`Time system "${system.id}" is already registered`);
    }
    this.systems.set(system.id, system);
  }

  /** The system, or null when nothing is registered under that id. */
  find(id: SystemId): TimeSystem | null {
    return this.systems.get(id) ?? null;
  }

  /**
   * The system, or a thrown error naming what was asked for.
   *
   * For call sites where a missing system means the caller is wrong rather than
   * the data being incomplete — resolving a stored `Planning.system` that no
   * longer has an implementation, for instance.
   */
  get(id: SystemId): TimeSystem {
    const system = this.find(id);
    if (!system) throw new Error(`Unknown time system: "${id}"`);
    return system;
  }

  all(): readonly TimeSystem[] {
    return [...this.systems.values()];
  }

  /** One scale, by the pair that identifies it. Null if either half is unknown. */
  scale(system: SystemId, scale: ScaleId): Scale | null {
    return this.find(system)?.scales.find((s) => s.id === scale) ?? null;
  }
}
