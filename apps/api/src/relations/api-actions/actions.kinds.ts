import type { BlockKind } from '../../core/kinds/kind.contract';
import {
  ActionItemSchema,
  ACTIONS_ITEM_KIND,
  ACTIONS_ITEM_CAPABILITIES,
  type ActionItemProperties,
} from '@nau/actions';

/**
 * What Actions contributes to the running system.
 *
 * A single kind, per `tmp/actions-blueprint.md` §2.1 — action, habit,
 * project and routine are cells of two derived axes (has children? does its
 * plan repeat?), not four things to enumerate here.
 *
 * The schema and the capabilities are Actions' domain rules, defined in
 * `@nau/actions` — a package with no dependency on this api, so the same
 * rules can validate an item on a device that never reaches this file. What
 * is api-shaped, and stays here, is the registration itself: wiring those
 * rules into `core/kinds`, and declaring which fields become projected
 * columns — a decision about this database, not about what an item means.
 */

export const actionsItemKind: BlockKind<ActionItemProperties> = {
  id: ACTIONS_ITEM_KIND,
  schema: ActionItemSchema,
  capabilities: ACTIONS_ITEM_CAPABILITIES,
  /**
   * `status` is the most frequently queried field in Actions — the agenda,
   * next-actions and the tray all filter by it — and today it is read and
   * written as raw JSON with no index (nau#64 point 4). Projecting it is
   * what that issue asked for.
   */
  projections: [{ property: 'status', type: 'text' }],
};

export const ACTIONS_KINDS = [actionsItemKind] as const;
