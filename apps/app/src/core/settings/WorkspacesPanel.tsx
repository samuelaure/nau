'use client'

import { useState } from 'react'
import { Button } from '@9nau/ui/components/button'
import { Input } from '@9nau/ui/components/input'
import {
  Plus, ChevronDown, ChevronRight, Building2,
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
  type WorkspaceWithRole,
  type WorkspaceMember,
} from '@/core/identity/use-workspaces'
import { WorkspaceRole } from '@9nau/types'

/**
 * Workspaces and their members — identity's own settings tab.
 *
 * Was `app/(main)/settings/page.tsx` in full, before Settings became one
 * shared surface (`SettingsSurface`) with tabs. This is the core's own tab;
 * each module supplies its own alongside it, and none of them know about
 * this one or about each other.
 */
export function WorkspacesPanel() {
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
    return <p className="text-gray-500 dark:text-gray-400">Loading workspaces…</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input
          placeholder="New workspace name…"
          value={newWsName}
          onChange={(e) => setNewWsName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
        />
        <Button onClick={handleCreateWorkspace} disabled={createWorkspace.isPending}>
          <Plus className="mr-1 h-4 w-4" /> Create
        </Button>
      </div>

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
          <p className="py-8 text-center text-sm text-gray-400">No workspaces yet. Create one above.</p>
        )}
      </div>
    </div>
  )
}

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
    if (!newName.trim() || newName === workspace.name) {
      setRenaming(false)
      return
    }
    await renameWs.mutateAsync({ name: newName.trim() })
    setRenaming(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete workspace "${workspace.name}"? This cannot be undone.`)) return
    await deleteWs.mutateAsync()
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between bg-gray-50 px-4 py-3 dark:bg-gray-800">
        <button onClick={onToggle} className="flex flex-1 items-center gap-3 text-left transition-opacity hover:opacity-80">
          <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
          {!renaming && <span className="font-medium text-gray-900 dark:text-white">{workspace.name}</span>}
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs capitalize text-gray-400 dark:bg-gray-600">
            {workspace.role}
          </span>
          {isExpanded ? (
            <ChevronDown className="ml-auto h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />
          )}
        </button>

        {workspace.role === WorkspaceRole.OWNER && !renaming && (
          <div className="ml-2 flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setNewName(workspace.name) }}
              className="rounded p-1.5 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
              title="Rename workspace"
            >
              <PencilLine className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete() }}
              disabled={deleteWs.isPending}
              className="rounded p-1.5 text-gray-400 transition-colors hover:text-red-500"
              title="Delete workspace"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {renaming && (
        <div className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
            className="h-8 text-sm"
          />
          <button onClick={handleRename} disabled={renameWs.isPending} className="rounded p-1.5 text-green-600 hover:text-green-700">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => setRenaming(false)} className="rounded p-1.5 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
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
          <li key={m.id} className="group flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <div>
              <span className="text-sm text-gray-800 dark:text-gray-200">{m.user.name ?? m.user.email}</span>
              <span className="ml-2 text-xs text-gray-400">{m.user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-400 dark:bg-gray-700">
                {m.role}
              </span>
              {isOwner && m.role !== WorkspaceRole.OWNER && (
                <button
                  onClick={() => handleRemove(m)}
                  className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  title="Remove member"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </li>
        ))}
        {(members ?? []).length === 0 && <li className="text-xs italic text-gray-400">No members found.</li>}
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
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
