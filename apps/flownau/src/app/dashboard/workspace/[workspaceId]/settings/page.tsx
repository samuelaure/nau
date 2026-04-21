'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Users, Building2 } from 'lucide-react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Input } from '@/modules/shared/components/ui/Input'
import { Button } from '@/modules/shared/components/ui/Button'

type Member = {
  id: string
  role: string
  user: { id: string; email: string; name: string | null }
}

export default function WorkspaceSettingsPage() {
  const params = useParams<{ workspaceId: string }>()
  const workspaceId = params.workspaceId

  const [name, setName] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [wsRes, membersRes] = await Promise.all([
          fetch('/api/workspaces'),
          fetch(`/api/workspaces/${workspaceId}/members`),
        ])
        const workspaces: { id: string; name: string }[] = wsRes.ok ? await wsRes.json() : []
        const ws = workspaces.find((w) => w.id === workspaceId)
        if (ws) {
          setName(ws.name)
          setOriginalName(ws.name)
        }
        const memberList: Member[] = membersRes.ok ? await membersRes.json() : []
        setMembers(memberList)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [workspaceId])

  const handleSave = async () => {
    if (!name.trim() || name.trim() === originalName) return
    setSaving(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error()
      setOriginalName(name.trim())
      toast.success('Workspace name updated.')
    } catch {
      toast.error('Failed to update workspace name.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-text-secondary" size={28} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <header className="mb-10">
        <h1 className="text-3xl font-heading font-semibold mb-2">Workspace Settings</h1>
        <p className="text-text-secondary text-sm">Manage this workspace&apos;s name and members.</p>
      </header>

      {/* Name */}
      <Card className="p-8 mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 size={16} className="text-text-secondary" />
          <h2 className="text-base font-semibold">General</h2>
        </div>
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
              disabled={saving || !name.trim() || name.trim() === originalName}
              className="gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </Card>

      {/* Members */}
      <Card className="p-8">
        <div className="flex items-center gap-2 mb-6">
          <Users size={16} className="text-text-secondary" />
          <h2 className="text-base font-semibold">Members</h2>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-text-secondary">No members found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <span className="text-sm font-medium">{m.user.name ?? m.user.email}</span>
                  {m.user.name && (
                    <span className="text-xs text-text-secondary ml-2">{m.user.email}</span>
                  )}
                </div>
                <span className="text-xs capitalize bg-gray-800 text-text-secondary px-2 py-0.5 rounded-full">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
