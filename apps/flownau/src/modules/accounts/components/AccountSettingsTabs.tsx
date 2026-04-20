'use client'

import { useState } from 'react'
import { cn } from '@/modules/shared/utils'
import AccountPersonas from './AccountPersonas'
import AccountContentPrinciples from './AccountContentPrinciples'
import AccountPlanners from './AccountPlanners'

type SettingsTab = 'account' | 'personas' | 'principles' | 'planner'

export default function AccountSettingsTabs({
  accountId,
  accountForm,
}: {
  accountId: string
  accountForm: React.ReactNode
}) {
  const [tab, setTab] = useState<SettingsTab>('account')

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'account', label: 'Account' },
    { id: 'personas', label: 'Personas' },
    { id: 'principles', label: 'Principles' },
    { id: 'planner', label: 'Planner' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex border-b border-white/5 gap-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-5 py-2.5 -mb-px text-sm border-b-2 transition-all whitespace-nowrap',
              tab === t.id
                ? 'text-accent border-accent font-semibold'
                : 'text-text-secondary border-transparent hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'account' && accountForm}
        {tab === 'personas' && <AccountPersonas accountId={accountId} />}
        {tab === 'principles' && <AccountContentPrinciples accountId={accountId} />}
        {tab === 'planner' && <AccountPlanners accountId={accountId} />}
      </div>
    </div>
  )
}
