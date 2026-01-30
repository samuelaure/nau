'use client'

import { useTransition } from 'react'
import { updateAccount } from '@/app/dashboard/accounts/actions'
import RefreshProfileButton from '@/app/dashboard/accounts/RefreshProfileButton'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { SocialAccount } from '@prisma/client'

export default function AccountSettings({ account }: { account: SocialAccount }) {
  const [isPending, startTransition] = useTransition()

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      await updateAccount(account.id, formData)
    })
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <Card className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-heading font-semibold">Account Settings</h3>
          <RefreshProfileButton accountId={account.id} />
        </div>

        <form action={handleUpdate} className="flex flex-col gap-6">
          <Input
            name="username"
            label="Username"
            defaultValue={account.username || ''}
            required
          />

          <Input
            name="platformId"
            label="Instagram User ID"
            defaultValue={account.platformId || ''}
            required
          />

          <div className="w-full">
            <label className="form-label">
              Access Token
              <span className="text-xs font-normal ml-2 opacity-70">
                (Optional rotation)
              </span>
            </label>
            <input
              name="accessToken"
              placeholder="**********************"
              className="input-field"
              type="password"
            />
            <p className="mt-2 text-text-secondary text-xs">
              Only provide a new token if you want to rotate it or it has expired.
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
