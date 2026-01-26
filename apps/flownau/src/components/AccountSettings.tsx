'use client'

import { useTransition } from 'react'
import { updateAccount } from '@/app/dashboard/accounts/actions'

export default function AccountSettings({ account }: { account: any }) {
  const [isPending, startTransition] = useTransition()

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      await updateAccount(account.id, formData)
    })
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px' }}>
      <div className="card" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '20px', marginBottom: '24px' }}>Account Settings</h3>

        <form action={handleUpdate} className="grid gap-6">
          <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Username</label>
            <input name="username" defaultValue={account.username} className="input" required />
          </div>
          <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Instagram User ID
            </label>
            <input name="platformId" defaultValue={account.platformId} className="input" required />
          </div>
          <div className="grid grid-cols-[1fr_2fr] items-start gap-4">
            <div className="pt-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Access Token
              </label>
              <span className="text-xs text-[var(--text-secondary)] mt-1 block">
                Optional rotation
              </span>
            </div>
            <div>
              <input
                name="accessToken"
                placeholder="**********************"
                className="input"
                type="password"
              />
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                Only provide a new token if you want to rotate it or it has expired.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--border-color)]">
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
