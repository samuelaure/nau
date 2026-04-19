'use client'

import { useTransition } from 'react'
import { updateAccount } from '@/modules/accounts/actions'
import RefreshProfileButton from '@/modules/accounts/components/RefreshProfileButton'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { Input } from '@/modules/shared/components/ui/Input'
import { Textarea } from '@/modules/shared/components/ui/Textarea'
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
          <Input name="username" label="Username" defaultValue={account.username || ''} required />

          <Input
            name="platformId"
            label="Instagram User ID"
            defaultValue={account.platformId || ''}
            required
          />

          <div className="w-full">
            <label className="form-label">
              Access Token
              <span className="text-xs font-normal ml-2 opacity-70">(Optional rotation)</span>
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

          <div className="w-full">
            <label className="form-label mb-1 block">
              Director system prompt (ONE)
              <span className="text-xs font-normal ml-2 opacity-70">
                Selection logic for idea-template fit. Scoped to Brand settings.
              </span>
            </label>
            <Textarea
              name="directorPrompt"
              defaultValue={(account as any).directorPrompt || ''}
              rows={4}
              className="bg-gray-950 border border-border text-white w-full rounded p-3 text-sm"
              placeholder="Explain how the AI should choose the best template for a given idea..."
            />
          </div>

          <div className="w-full">
            <label className="form-label mb-1 block">
              Creation system prompt (NATIVE)
              <span className="text-xs font-normal ml-2 opacity-70">
                Instructions for template iteration/building. Scoped to Brand settings.
              </span>
            </label>
            <Textarea
              name="creationPrompt"
              defaultValue={(account as any).creationPrompt || ''}
              rows={4}
              className="bg-gray-950 border border-border text-white w-full rounded p-3 text-sm"
              placeholder="Override the native structural rules with brand-specific iteration logic..."
            />
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
