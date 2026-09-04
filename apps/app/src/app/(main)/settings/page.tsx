'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react'
import { SettingsSurface } from '@/core/settings/settings-surface'
import { WorkspacesPanel } from '@/core/settings/WorkspacesPanel'

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div>
      {/* This route sits outside home/page.tsx's own topbar+padding, so it
          needs its own — otherwise the content sits flush against the fixed
          Header with no breathing room. A back button here is the one this
          page needs on its own: the sidebar's Home button already leaves any
          route back to /home, but this is the more obvious place to look for
          it while actually on the page. */}
      <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-white px-6 dark:border-gray-800 dark:bg-gray-950">
        <button
          onClick={() => router.push('/home')}
          aria-label="Volver"
          className="-ml-1.5 rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <SettingsIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">Settings</h1>
      </div>

      <div className="px-4 py-6 md:px-8">
        <SettingsSurface
          coreTabs={[{ id: 'workspaces', label: 'Workspaces', component: WorkspacesPanel }]}
        />
      </div>
    </div>
  )
}
