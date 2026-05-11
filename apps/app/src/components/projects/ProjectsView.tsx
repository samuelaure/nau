'use client'

import { useState } from 'react'
import { Plus, FolderOpen, Globe, PencilLine, Trash2, Check, X } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { Input } from '@9nau/ui/components/input'
import { cn } from '@9nau/ui/lib/utils'
import {
  useGetWorkspaces,
  useGetProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useGetBrands,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
} from '@/hooks/use-workspaces-api'
import { useUiStore } from '@/lib/state/ui-store'
import type { Project, Brand } from '@9nau/types'

export function ProjectsView() {
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId)
  const { data: workspaces } = useGetWorkspaces()

  const workspaceIds = activeWorkspaceId
    ? [activeWorkspaceId]
    : (workspaces ?? []).map((w) => w.id)

  if (!workspaces) {
    return <div className="text-sm text-gray-400 mt-8 text-center">Loading…</div>
  }

  if (workspaceIds.length === 0) {
    return (
      <div className="text-sm text-gray-400 mt-8 text-center">
        No workspaces yet. Create one in Settings.
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {workspaceIds.map((wsId) => {
        const ws = workspaces.find((w) => w.id === wsId)
        return (
          <WorkspaceSection
            key={wsId}
            workspaceId={wsId}
            workspaceName={ws?.name ?? wsId}
            showWorkspaceName={!activeWorkspaceId}
          />
        )
      })}
    </div>
  )
}

function WorkspaceSection({
  workspaceId,
  workspaceName,
  showWorkspaceName,
}: {
  workspaceId: string
  workspaceName: string
  showWorkspaceName: boolean
}) {
  return (
    <div className="space-y-6">
      {showWorkspaceName && (
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{workspaceName}</h2>
      )}
      <ProjectsSection workspaceId={workspaceId} />
      <BrandsSection workspaceId={workspaceId} />
    </div>
  )
}

// ── Projects ──────────────────────────────────────────────────────────────────

function ProjectsSection({ workspaceId }: { workspaceId: string }) {
  const { data: projects, isLoading } = useGetProjects(workspaceId)
  const createProject = useCreateProject(workspaceId)
  const deleteProject = useDeleteProject(workspaceId)
  const [newName, setNewName] = useState('')

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createProject.mutateAsync({ name: newName.trim() })
    setNewName('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <FolderOpen className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Projects</h3>
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
          {isLoading ? '…' : (projects ?? []).length}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400 pl-6">Loading…</p>
      ) : (
        <ul className="space-y-0.5 pl-1">
          {(projects ?? []).map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              workspaceId={workspaceId}
              onDelete={() => {
                if (confirm(`Delete project "${p.name}"?`)) deleteProject.mutate({ projectId: p.id })
              }}
            />
          ))}
          {(projects ?? []).length === 0 && (
            <li className="text-xs text-gray-400 italic pl-2">No projects yet.</li>
          )}
        </ul>
      )}

      <div className="flex gap-2 pt-1 pl-1">
        <Input
          placeholder="New project name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="text-sm h-8"
        />
        <Button size="sm" onClick={handleCreate} disabled={createProject.isPending}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

function ProjectRow({
  project,
  workspaceId,
  onDelete,
}: {
  project: Project
  workspaceId: string
  onDelete: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(project.name)
  const update = useUpdateProject(project.id, workspaceId)

  const handleRename = async () => {
    if (!newName.trim() || newName === project.name) { setRenaming(false); return }
    await update.mutateAsync({ name: newName.trim() })
    setRenaming(false)
  }

  if (renaming) {
    return (
      <li className="flex items-center gap-2 py-1 px-2">
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
          className="text-sm h-7 flex-1"
        />
        <button onClick={handleRename} disabled={update.isPending} className="p-1 text-green-600 hover:text-green-700">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setRenaming(false)} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </li>
    )
  }

  return (
    <li className={cn(
      'flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 group',
      !project.isActive && 'opacity-50'
    )}>
      <div className="flex items-center gap-2">
        <FolderOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className="text-sm text-gray-800 dark:text-gray-200">{project.name}</span>
        {project.description && (
          <span className="text-xs text-gray-400 truncate max-w-[200px]">{project.description}</span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setRenaming(true)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded">
          <PencilLine className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500 rounded">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  )
}

// ── Brands ────────────────────────────────────────────────────────────────────

function BrandsSection({ workspaceId }: { workspaceId: string }) {
  const { data: brands, isLoading } = useGetBrands(workspaceId)
  const createBrand = useCreateBrand(workspaceId)
  const deleteBrand = useDeleteBrand(workspaceId)
  const [newName, setNewName] = useState('')

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createBrand.mutateAsync({ name: newName.trim() })
    setNewName('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Brands</h3>
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
          {isLoading ? '…' : (brands ?? []).length}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400 pl-6">Loading…</p>
      ) : (
        <ul className="space-y-0.5 pl-1">
          {(brands ?? []).map((b) => (
            <BrandRow
              key={b.id}
              brand={b}
              workspaceId={workspaceId}
              onDelete={() => {
                if (confirm(`Delete brand "${b.name}"?`)) deleteBrand.mutate({ brandId: b.id })
              }}
            />
          ))}
          {(brands ?? []).length === 0 && (
            <li className="text-xs text-gray-400 italic pl-2">No brands yet.</li>
          )}
        </ul>
      )}

      <div className="flex gap-2 pt-1 pl-1">
        <Input
          placeholder="New brand name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="text-sm h-8"
        />
        <Button size="sm" onClick={handleCreate} disabled={createBrand.isPending}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

function BrandRow({
  brand,
  workspaceId,
  onDelete,
}: {
  brand: Brand
  workspaceId: string
  onDelete: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(brand.name)
  const update = useUpdateBrand(workspaceId, brand.id)

  const handleRename = async () => {
    if (!newName.trim() || newName === brand.name) { setRenaming(false); return }
    await update.mutateAsync({ name: newName.trim() })
    setRenaming(false)
  }

  if (renaming) {
    return (
      <li className="flex items-center gap-2 py-1 px-2">
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
          className="text-sm h-7 flex-1"
        />
        <button onClick={handleRename} disabled={update.isPending} className="p-1 text-green-600 hover:text-green-700">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setRenaming(false)} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </li>
    )
  }

  return (
    <li className={cn(
      'flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 group',
      brand.isActive === false && 'opacity-50'
    )}>
      <div className="flex items-center gap-2">
        <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="text-sm text-gray-800 dark:text-gray-200">{brand.name}</span>
        {brand.handle && <span className="text-xs text-gray-400">@{brand.handle}</span>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setRenaming(true)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded">
          <PencilLine className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500 rounded">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  )
}
