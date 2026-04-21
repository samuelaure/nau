'use client'

import { useTransition, useEffect, useState } from 'react'
import { updateAccount, moveAccountToWorkspace } from '@/modules/accounts/actions'
import RefreshProfileButton from '@/modules/accounts/components/RefreshProfileButton'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { Input } from '@/modules/shared/components/ui/Input'
import { Textarea } from '@/modules/shared/components/ui/Textarea'
import type { SocialAccount } from '@prisma/client'

export default function AccountSettings({ account }: { account: SocialAccount }) {
  const [isPending, startTransition] = useTransition()
  const [movePending, startMoveTransition] = useTransition()
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([])
  const [targetWs, setTargetWs] = useState('')

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setWorkspaces(data)
        const other = data.find((w: { id: string }) => w.id !== (account as any).workspaceId)
        if (other) setTargetWs(other.id)
      })
      .catch(() => {})
  }, [])

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

      {workspaces.length > 1 && (
        <Card className="p-6 mt-6">
          <h3 className="text-base font-semibold mb-4">Move to Workspace</h3>
          <div className="flex items-center gap-3">
            <select
              value={targetWs}
              onChange={(e) => setTargetWs(e.target.value)}
              className="bg-gray-950 border border-border text-white rounded px-3 py-2 text-sm flex-1"
            >
              {workspaces
                .filter((w) => w.id !== (account as any).workspaceId)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
            <Button
              disabled={movePending || !targetWs}
              onClick={() => {
                startMoveTransition(async () => {
                  await moveAccountToWorkspace(account.id, targetWs)
                })
              }}
            >
              {movePending ? 'Moving…' : 'Move'}
            </Button>
          </div>
          <p className="text-xs text-text-secondary mt-2">
            Current workspace: {workspaces.find((w) => w.id === (account as any).workspaceId)?.name ?? 'Unknown'}
          </p>
        </Card>
      )}
    </div>
  )
}
