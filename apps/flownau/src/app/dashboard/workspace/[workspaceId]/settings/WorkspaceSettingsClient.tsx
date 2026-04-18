'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { Input } from '@/modules/shared/components/ui/Input'
import { toast } from 'sonner'
import { Loader2, Trash2, UserPlus, LogOut } from 'lucide-react'

interface Member {
  id: string
  platformUserId: string
  role: string
}

interface Props {
  workspace: { id: string; name: string }
  currentUserId: string
  currentUserRole: string
  initialMembers: Member[]
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

export default function WorkspaceSettingsClient({
  workspace,
  currentUserId,
  currentUserRole,
  initialMembers,
}: Props) {
  const router = useRouter()
  const canManage = ['owner', 'admin'].includes(currentUserRole)

  // Workspace name
  const [workspaceName, setWorkspaceName] = useState(workspace.name)
  const [savingName, setSavingName] = useState(false)

  // Members
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Delete workspace
  const [deletingWorkspace, setDeletingWorkspace] = useState(false)

  const handleSaveName = async () => {
    if (!workspaceName.trim()) return toast.error('Name cannot be empty')
    setSavingName(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName.trim() }),
      })
      if (!res.ok) throw new Error()
      toast.success('Workspace name updated')
      router.refresh()
    } catch {
      toast.error('Failed to update workspace name')
    } finally {
      setSavingName(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return toast.error('Enter an email address')
    setInviting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add member')
      toast.success(`Added ${inviteEmail} as ${inviteRole}`)
      setInviteEmail('')
      // Refresh member list
      const listRes = await fetch(`/api/workspaces/${workspace.id}/members`)
      const listData = await listRes.json()
      setMembers(listData.members || [])
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this collaborator from the workspace?')) return
    setRemovingId(userId)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      setMembers(members.filter((m) => m.platformUserId !== userId))
      toast.success('Collaborator removed')
    } catch {
      toast.error('Failed to remove collaborator')
    } finally {
      setRemovingId(null)
    }
  }

  const handleDeleteWorkspace = async () => {
    if (
      !confirm(
        `Are you absolutely sure you want to delete "${workspace.name}"? This will remove all accounts, personas, and content linked to this workspace and cannot be undone.`,
      )
    )
      return
    setDeletingWorkspace(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Workspace deleted')
      router.push('/dashboard')
    } catch {
      toast.error('Failed to delete workspace')
      setDeletingWorkspace(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl animate-fade-in">
      <header>
        <h1 className="text-3xl font-heading font-semibold mb-1">Workspace Settings</h1>
        <p className="text-text-secondary text-sm">
          Manage the name, collaborators, and lifecycle of this workspace.
        </p>
      </header>

      {/* Workspace Metadata */}
      <Card className="p-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold">Workspace Name</h2>
        <div className="flex gap-3 items-center">
          <Input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="bg-gray-950 border-gray-800 text-white"
            disabled={!canManage || savingName}
          />
          {canManage && (
            <Button
              onClick={handleSaveName}
              disabled={savingName || workspaceName.trim() === workspace.name}
            >
              {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          )}
        </div>
      </Card>

      {/* Collaborators */}
      <Card className="p-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold">Collaborators</h2>

        <div className="flex flex-col gap-2">
          {members.map((m) => {
            const isSelf = m.platformUserId === currentUserId
            const canRemove = m.role !== 'owner' && (canManage || isSelf)

            return (
              <div
                key={m.id}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
                    {(m.platformUserId[0] ?? '?').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {m.platformUserId || ""}
                      {isSelf && (
                        <span className="ml-2 text-[10px] text-accent font-bold uppercase tracking-widest">
                          You
                        </span>
                      )}
                    </p>
                    {m.platformUserId && <p className="text-xs text-gray-500">{""}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      m.role === 'owner'
                        ? 'bg-accent/20 text-accent'
                        : m.role === 'admin'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                  {canRemove && (
                    <button
                      onClick={() => handleRemoveMember(m.platformUserId)}
                      disabled={removingId === m.platformUserId}
                      className="text-gray-600 hover:text-red-400 transition"
                      title={isSelf ? 'Leave workspace' : 'Remove member'}
                    >
                      {removingId === m.platformUserId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isSelf ? (
                        <LogOut className="w-4 h-4" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {canManage && (
          <div className="mt-4 flex flex-col gap-3 pt-4 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-gray-300">Add Collaborator</h3>
            <div className="flex gap-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="bg-gray-950 border-gray-800 text-white flex-1"
                disabled={inviting}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                className="bg-gray-950 border border-gray-800 text-white rounded p-2 text-sm"
                disabled={inviting}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              The user must already have a flownaŭ account. They will gain immediate access.
            </p>
          </div>
        )}
      </Card>

      {/* Danger Zone */}
      {currentUserRole === 'owner' && (
        <Card className="p-6 border-red-900/40 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-red-400">Danger Zone</h2>
          <p className="text-sm text-gray-400">
            Deleting this workspace is permanent and will remove all linked accounts, content, and
            assets. This action cannot be undone.
          </p>
          <div>
            <Button
              onClick={handleDeleteWorkspace}
              disabled={deletingWorkspace}
              className="bg-red-900/60 text-red-300 hover:bg-red-900 border border-red-800"
            >
              {deletingWorkspace ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Workspace
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
