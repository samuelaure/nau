'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Users, Building2, UserPlus, Trash2 } from 'lucide-react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Input } from '@/modules/shared/components/ui/Input'
import { Button } from '@/modules/shared/components/ui/Button'

type Member = {
  id: string
  role: string
  user: { id: string; email: string; name: string | null }
}

const ROLES = ['member', 'admin']

export default function WorkspaceSettingsPage() {
  const params = useParams<{ workspaceId: string }>()
  const workspaceId = params.workspaceId

  const [name, setName] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState<string | null>(null)

  // Add member form
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState('member')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [wsRes, membersRes, meRes] = await Promise.all([
          fetch('/api/workspaces'),
          fetch(`/api/workspaces/${workspaceId}/members`),
          fetch('/api/auth/me'),
        ])
        const workspaces: { id: string; name: string }[] = wsRes.ok ? await wsRes.json() : []
        const ws = workspaces.find((w) => w.id === workspaceId)
        if (ws) {
          setName(ws.name)
          setOriginalName(ws.name)
        }
        const memberList: Member[] = membersRes.ok ? await membersRes.json() : []
        setMembers(memberList)
        if (meRes.ok) {
          const me = await meRes.json()
          setCurrentUserId(me.id ?? me.sub ?? null)
          const myMembership = memberList.find((m) => m.user.id === (me.id ?? me.sub))
          setCurrentRole(myMembership?.role ?? null)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [workspaceId])

  const canManage = currentRole === 'owner' || currentRole === 'admin'

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

  const handleAddMember = async () => {
    if (!addEmail.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message ?? 'Failed to add member')
      }
      const newMember: Member = await res.json()
      setMembers((prev) => [...prev, newMember])
      setAddEmail('')
      toast.success('Member added.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add member.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (member: Member) => {
    setRemovingId(member.id)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${member.user.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
      toast.success('Member removed.')
    } catch {
      toast.error('Failed to remove member.')
    } finally {
      setRemovingId(null)
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
        <p className="text-text-secondary text-sm">
          Manage this workspace&apos;s name and members.
        </p>
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
          <p className="text-sm text-text-secondary mb-6">No members found.</p>
        ) : (
          <ul className="divide-y divide-border mb-6">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <span className="text-sm font-medium">{m.user.name ?? m.user.email}</span>
                  {m.user.name && (
                    <span className="text-xs text-text-secondary ml-2">{m.user.email}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs capitalize bg-gray-800 text-text-secondary px-2 py-0.5 rounded-full">
                    {m.role}
                  </span>
                  {canManage && m.user.id !== currentUserId && m.role !== 'owner' && (
                    <button
                      onClick={() => handleRemove(m)}
                      disabled={removingId === m.id}
                      className="text-text-secondary hover:text-red-400 transition-colors disabled:opacity-50"
                      aria-label="Remove member"
                    >
                      {removingId === m.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <div className="border-t border-border pt-6">
            <p className="text-xs text-text-secondary mb-3 font-medium uppercase tracking-wide">
              Add member
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Email address"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddMember()
                  }}
                />
              </div>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
                className="bg-surface border border-border rounded-lg px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              <Button onClick={handleAddMember} disabled={adding || !addEmail.trim()} className="gap-2 shrink-0">
                {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Add
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
