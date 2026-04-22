'use client'

import { useState } from 'react'
import { Input } from '@/modules/shared/components/ui/Input'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const NAU_API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_NAU_API_URL) || 'https://api.9nau.com'

export default function WorkspaceNameEditor({
  workspaceId,
  currentName,
}: {
  workspaceId: string
  currentName: string
}) {
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || name.trim() === currentName) return
    setSaving(true)
    try {
      const res = await fetch(`${NAU_API_URL}/workspaces/${workspaceId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error()
      toast.success('Workspace name updated.')
    } catch {
      toast.error('Failed to update workspace name.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Workspace name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
        }}
      />
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || name.trim() === currentName}
          className="gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  )
}
