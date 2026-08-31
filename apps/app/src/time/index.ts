import type { ModuleDescriptor } from '@/core/module-registry/contract'
import { TimeSystemSettings } from './TimeSystemSettings'

/**
 * Time's declaration to the core. No route and no nav entry — nothing in
 * Time has its own page today, only a settings tab. A module is not
 * required to have a face beyond that; the registry does not miss what
 * this does not declare.
 */
export const timeModule: ModuleDescriptor = {
  id: 'time',
  settingsPanel: {
    label: 'Calendario',
    component: TimeSystemSettings,
    order: 10,
  },
}

export { useTimeSystems, useUpdateTimeSystem } from './use-time-systems'
