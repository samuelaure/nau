'use client'

import { useState } from 'react'
import { Button } from '@9nau/ui/components/button'
import { Input } from '@9nau/ui/components/input'
import {
  Plus, ChevronDown, ChevronRight, Users, Building2,
  Trash2, Check, X, PencilLine,
} from 'lucide-react'
import {
  useGetWorkspaces,
  useCreateWorkspace,
  useRenameWorkspace,
  useDeleteWorkspace,
  useGetMembers,
  useAddMember,
  useRemoveMember,
} from '@/hooks/use-workspaces-api'
import type { WorkspaceWithRole, WorkspaceMember } from '@/hooks/use-workspaces-api'
import { WorkspaceRole } from '@9nau/types'

export default function PlatformSettingsPage() {
  const { data: workspaces, isLoading } = useGetWorkspaces()
  const createWorkspace = useCreateWorkspace()

  const [newWsName, setNewWsName] = useState('')
  const [expandedWs, setExpandedWs] = useState<string | null>(null)

  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) return
    await createWorkspace.mutateAsync({ name: newWsName.trim() })
    setNewWsName('')
  }

  if (isLoading) {
    return <div className="p-8 text-gray-500 dark:text-gray-400">Loading workspaces…</div>
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Workspaces</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage workspaces and members. Projects and Brands are managed in the Projects section.
        </p>
      </div>

      {/* Create new workspace */}
      <div className="flex gap-2">
        <Input
          placeholder="New workspace name…"
          value={newWsName}
          onChange={(e) => setNewWsName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
        />
        <Button onClick={handleCreateWorkspace} disabled={createWorkspace.isPending}>
          <Plus className="w-4 h-4 mr-1" /> Create
        </Button>
      </div>

      {/* Workspace list */}
      <div className="space-y-3">
        {(workspaces ?? []).map((ws) => (
          <WorkspaceCard
            key={ws.id}
            workspace={ws}
            isExpanded={expandedWs === ws.id}
            onToggle={() => setExpandedWs(expandedWs === ws.id ? null : ws.id)}
          />
        ))}
        {(workspaces ?? []).length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No workspaces yet. Create one above.</p>
        )}
      </div>
    </div>
  )
}

// ── WorkspaceCard ─────────────────────────────────────────────────────────────

function WorkspaceCard({
  workspace,
  isExpanded,
  onToggle,
}: {
  workspace: WorkspaceWithRole
  isExpanded: boolean
  onToggle: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(workspace.name)
  const renameWs = useRenameWorkspace(workspace.id)
  const deleteWs = useDeleteWorkspace(workspace.id)

  const handleRename = async () => {
    if (!newName.trim() || newName === workspace.name) { setRenaming(false); return }
    await renameWs.mutateAsync({ name: newName.trim() })
    setRenaming(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete workspace "${workspace.name}" and all its brands? This cannot be undone.`)) return
    await deleteWs.mutateAsync()
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity">
          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
          {renaming ? null : (
            <span className="font-medium text-gray-900 dark:text-white">{workspace.name}</span>
          )}
          <span className="text-xs text-gray-400 capitalize bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
            {workspace.role}
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" /> : <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />}
        </button>

        {workspace.role === WorkspaceRole.OWNER && !renaming && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setNewName(workspace.name) }}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
              title="Rename workspace"
            >
              <PencilLine className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete() }}
              disabled={deleteWs.isPending}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
              title="Delete workspace"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {renaming && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
            className="text-sm h-8"
          />
          <button onClick={handleRename} disabled={renameWs.isPending} className="p-1.5 text-green-600 hover:text-green-700 rounded">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setRenaming(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="px-4 pb-4 pt-3">
          <MembersPanel workspaceId={workspace.id} isOwner={workspace.role === WorkspaceRole.OWNER} />
        </div>
      )}
    </div>
  )
}

// ── MembersPanel ──────────────────────────────────────────────────────────────

function MembersPanel({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
  const { data: members, isLoading } = useGetMembers(workspaceId)
  const addMember = useAddMember(workspaceId)
  const removeMember = useRemoveMember(workspaceId)
  const [inviteEmail, setInviteEmail] = useState('')

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    await addMember.mutateAsync({ email: inviteEmail.trim(), role: 'member' })
    setInviteEmail('')
  }

  const handleRemove = async (member: WorkspaceMember) => {
    if (!confirm(`Remove ${member.user.email} from this workspace?`)) return
    await removeMember.mutateAsync({ userId: member.userId })
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading members…</p>

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {(members ?? []).map((m) => (
          <li key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
            <div>
              <span className="text-sm text-gray-800 dark:text-gray-200">{m.user.name ?? m.user.email}</span>
              <span className="text-xs text-gray-400 ml-2">{m.user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs capitalize text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {m.role}
              </span>
              {isOwner && m.role !== WorkspaceRole.OWNER && (
                <button
                  onClick={() => handleRemove(m)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove member"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </li>
        ))}
        {(members ?? []).length === 0 && (
          <li className="text-xs text-gray-400 italic">No members found.</li>
        )}
      </ul>

      {isOwner && (
        <div className="flex gap-2 pt-1">
          <Input
            placeholder="Invite by email…"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            className="text-sm"
          />
          <Button size="sm" onClick={handleInvite} disabled={addMember.isPending}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
