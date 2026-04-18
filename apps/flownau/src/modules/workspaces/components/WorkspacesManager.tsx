'use client'

import { useState } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Plus, Trash } from 'lucide-react'
import {
  createWorkspace,
  renameWorkspace,
  deleteWorkspace,
  inviteUserToWorkspace,
  removeUserFromWorkspace,
} from '@/modules/workspaces/actions'

type WorkspaceUser = {
  id: string
  role: string
  platformUserId: string
}

type Workspace = {
  id: string
  name: string
  users: WorkspaceUser[]
}

export default function WorkspacesManager({
  workspaces,
  currentUserId,
}: {
  workspaces: Workspace[]
  currentUserId: string
}) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaces[0]?.id || '')

  const [isCreating, setIsCreating] = useState(false)
  const [isInviting, setIsInviting] = useState(false)

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
  const currentUserRole = activeWorkspace?.users.find((u) => u.platformUserId === currentUserId)?.role

  // ... (UI to follow in iterations or as one block)
  return (
    <Card className="p-8 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-heading font-semibold">Workspaces</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/90"
        >
          <Plus size={16} className="inline mr-2" /> New Workspace
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar for workspaces */}
        <div className="w-1/3 border-r border-white/10 pr-4">
          {workspaces.map((w) => (
            <div
              key={w.id}
              onClick={() => {
                setActiveWorkspaceId(w.id)
                setIsCreating(false)
              }}
              className={`p-3 cursor-pointer rounded-lg mb-2 flex justify-between items-center transition-colors ${
                w.id === activeWorkspaceId ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <div className="font-medium truncate">{w.name}</div>
              <div className="text-xs text-text-secondary capitalize tracking-wide">
                {w.users.find((u) => u.platformUserId === currentUserId)?.role}
              </div>
            </div>
          ))}

          {isCreating && (
            <form
              action={async (fd) => {
                await createWorkspace(fd)
                setIsCreating(false)
              }}
              className="mt-4 p-3 bg-white/5 rounded-lg border border-accent/30"
            >
              <input
                name="name"
                required
                className="w-full bg-panel p-2 rounded text-sm mb-3 border border-white/10"
                placeholder="Workspace name"
              />
              <div className="flex gap-2">
                <button type="submit" className="bg-accent text-white px-3 py-1.5 rounded text-xs">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Detail view for active workspace */}
        <div className="w-2/3 pl-2">
          {activeWorkspace ? (
            <div>
              <div className="flex justify-between items-center mb-6">
                <form action={renameWorkspace} className="flex gap-2 flex-1 items-center">
                  <input type="hidden" name="workspaceId" value={activeWorkspace.id} />
                  <input
                    name="name"
                    defaultValue={activeWorkspace.name}
                    className="bg-transparent border-b border-transparent focus:border-white/20 text-xl font-heading font-medium p-1 w-full max-w-[200px]"
                    disabled={currentUserRole !== 'owner'}
                  />
                  {currentUserRole === 'owner' && (
                    <button type="submit" className="text-xs text-text-secondary hover:text-white">
                      Save Name
                    </button>
                  )}
                </form>

                {currentUserRole === 'owner' && workspaces.length > 1 && (
                  <button
                    onClick={async () => {
                      if (confirm('Delete this workspace?')) {
                        await deleteWorkspace(activeWorkspace.id)
                        setActiveWorkspaceId(
                          workspaces.find((w) => w.id !== activeWorkspace.id)?.id || '',
                        )
                      }
                    }}
                    className="text-error hover:bg-error/10 p-2 rounded-lg"
                    title="Delete Workspace"
                  >
                    <Trash size={18} />
                  </button>
                )}
              </div>

              <div className="mb-4 flex justify-between items-center">
                <h4 className="font-semibold text-text-secondary text-sm">
                  Members ({activeWorkspace.users.length})
                </h4>
                {['owner', 'admin'].includes(currentUserRole || '') && (
                  <button
                    onClick={() => setIsInviting(!isInviting)}
                    className="text-xs text-accent hover:text-white"
                  >
                    + Invite User
                  </button>
                )}
              </div>

              {isInviting && (
                <form
                  action={async (fd) => {
                    await inviteUserToWorkspace(fd)
                    setIsInviting(false)
                  }}
                  className="mb-4 p-4 bg-white/5 rounded-lg border border-white/10 flex gap-3 items-end"
                >
                  <input type="hidden" name="workspaceId" value={activeWorkspace.id} />
                  <div className="flex-1">
                    <label className="text-xs block mb-1">Email</label>
                    <input
                      name="email"
                      type="email"
                      required
                      className="w-full bg-panel p-2 rounded text-sm border border-white/10"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs block mb-1">Role</label>
                    <select
                      name="role"
                      className="bg-panel p-2 rounded text-sm border border-white/10"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-accent text-white px-4 py-2 rounded text-sm">
                    Invite
                  </button>
                </form>
              )}

              <div className="bg-panel rounded-lg overflow-hidden border border-white/5">
                {activeWorkspace.users.map((wu) => (
                  <div
                    key={wu.id}
                    className="p-3 border-b border-white/5 last:border-0 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-sm">{wu.platformUserId || 'Unnamed'}</div>
                      <div className="text-xs text-text-secondary">{""}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs px-2 py-1 bg-white/10 rounded uppercase">
                        {wu.role}
                      </span>

                      {/* Can remove if owner/admin, or if it's yourself (leave) */}
                      {(['owner', 'admin'].includes(currentUserRole || '') ||
                        wu.platformUserId === currentUserId) && (
                        <button
                          onClick={async () => {
                            if (confirm('Remove user from workspace?')) {
                              await removeUserFromWorkspace(activeWorkspace.id, wu.platformUserId)
                            }
                          }}
                          className="text-text-secondary hover:text-error"
                        >
                          <Trash size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-text-secondary">
              Select or create a workspace
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
