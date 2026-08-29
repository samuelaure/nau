'use client'

import { SettingsSurface } from '@/core/settings/settings-surface'
import { WorkspacesPanel } from '@/core/settings/WorkspacesPanel'

export default function SettingsPage() {
  return (
    <SettingsSurface
      coreTabs={[{ id: 'workspaces', label: 'Workspaces', component: WorkspacesPanel }]}
    />
  )
}
