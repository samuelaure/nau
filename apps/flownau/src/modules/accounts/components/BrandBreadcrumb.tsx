'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/modules/shared/utils'

type Account = { id: string; username: string | null; profileImage: string | null }

export default function BrandBreadcrumb({
  workspaceId,
  activeAccountId,
  activeUsername,
}: {
  workspaceId: string
  activeAccountId: string
  activeUsername: string
}) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/workspace-accounts?workspaceId=${workspaceId}`)
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((data) => setAccounts(data.accounts || []))
      .catch(() => {})
  }, [workspaceId])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-white font-medium hover:text-accent transition-colors"
      >
        @{activeUsername}
        <ChevronDown size={14} className="text-text-secondary" />
      </button>

      {open && accounts.length > 1 && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-panel border border-white/10 rounded-xl shadow-xl w-52 overflow-hidden">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => {
                setOpen(false)
                if (acc.id !== activeAccountId) {
                  router.push(`/dashboard/workspace/${workspaceId}/account/${acc.id}`)
                }
              }}
              className={cn(
                'w-full text-left flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-colors',
                acc.id === activeAccountId ? 'text-white font-semibold' : 'text-text-secondary',
              )}
            >
              <span>@{acc.username ?? acc.id}</span>
              {acc.id === activeAccountId && <Check size={13} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
