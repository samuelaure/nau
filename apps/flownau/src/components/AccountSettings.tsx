'use client'

import { useTransition } from 'react'
import { updateAccount } from '@/app/dashboard/accounts/actions'
import RefreshProfileButton from '@/app/dashboard/accounts/RefreshProfileButton'

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', margin: 0 }}>Account Settings</h3>
          <RefreshProfileButton accountId={account.id} />
        </div>

        <form action={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input name="username" defaultValue={account.username} className="input-field" required />
          </div>
          <div className="form-group">
            <label className="form-label">Instagram User ID</label>
            <input name="platformId" defaultValue={account.platformId} className="input-field" required />
          </div>
          <div className="form-group">
            <label className="form-label">
              Access Token
              <span style={{ fontSize: '12px', fontWeight: '400', marginLeft: '8px', opacity: 0.7 }}>
                (Optional rotation)
              </span>
            </label>
            <input
              name="accessToken"
              placeholder="**********************"
              className="input-field"
              type="password"
            />
            <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
              Only provide a new token if you want to rotate it or it has expired.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
