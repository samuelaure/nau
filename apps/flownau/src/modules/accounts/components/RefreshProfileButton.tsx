'use client'

import { useTransition } from 'react'
import { RotateCw } from 'lucide-react'
import { syncAccountProfile } from '@/modules/accounts/actions'

export default function RefreshProfileButton({ accountId }: { accountId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleRefresh = () => {
    startTransition(async () => {
      await syncAccountProfile(accountId)
    })
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      className="btn-secondary"
      style={{
        padding: '6px 12px',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        height: '32px',
      }}
      title="Refresh profile data from Instagram"
    >
      <RotateCw size={14} className={isPending ? 'animate-spin' : ''} />
      {isPending ? 'Syncing...' : 'Refresh Profile'}
    </button>
  )
}
