'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Home, Inbox, CheckCircle2, Trash2, Building2, ChevronDown, Check, Lightbulb, CheckSquare, BookOpen, StickyNote } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { cn } from '@9nau/ui/lib/utils'
import { useWorkspaceStore } from '@/core/identity/workspace-store'
import { useGetWorkspaces } from '@/core/identity/use-workspaces'
import { useUiStore } from '@/lib/state/ui-store'
import { useShellStore } from './shell-store'

/**
 * The navigation frame.
 *
 * Unlike Keep, this sidebar is not a list of labels — naŭ has no labels.
 * It is: capture, the two GTD queues (Procesar/Revisar), and Home. Everything
 * else that used to live here (Acciones, Journal, Buscar, Proyectos) moved to
 * the content tabs, so the sidebar no longer needs to know those modules
 * exist — see `WORKSPACE_VIEWS`, kept only for the tabs that read it now.
 *
 * "Procesar" and "Revisar" show a count, but there is no query yet for
 * "blocks needing processing" or "references needing review" (that is GTD
 * Process/Order and References Revisar, both still unimplemented — see
 * tmp/flows/IMPLEMENTATION-PLAN.md). Rather than fabricate a number, both
 * queues render as always-empty, disabled entries with a toast on click,
 * until that data exists.
 */
export function Sidebar() {
  const router = useRouter()
  const isSidebarOpen = useShellStore((s) => s.isSidebarOpen)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const { data: workspaces } = useGetWorkspaces()
  const activeView = useUiStore((s) => s.activeView)
  const setView = useUiStore((s) => s.actions.setView)

  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [toast, setToast] = React.useState<string | null>(null)
  const createRef = React.useRef<HTMLDivElement>(null)

  const activeWorkspace = workspaces?.find((w) => w.id === activeWorkspaceId) ?? null

  React.useEffect(() => {
    if (!isCreateOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setIsCreateOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isCreateOpen])

  React.useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <aside
      className={cn(
        'fixed top-16 left-0 h-[calc(100vh-4rem)] border-r bg-white transition-all duration-200 dark:border-gray-800 dark:bg-gray-900 z-20',
        isSidebarOpen ? 'w-64' : 'w-20',
      )}
    >
      <nav className="flex h-full flex-col p-3">
        <div ref={createRef} className="relative mb-4">
          <Button
            onClick={() => setIsCreateOpen((o) => !o)}
            className={cn(
              'flex h-11 w-full items-center gap-3 rounded-full bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90',
              isSidebarOpen ? 'justify-start' : 'justify-center',
            )}
          >
            <Plus className="h-5 w-5" />
            {isSidebarOpen && <span className="font-medium">Crear</span>}
          </Button>

          {isCreateOpen && (
            <ul
              role="menu"
              className={cn(
                'absolute top-full z-30 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900',
                isSidebarOpen ? 'left-0 right-0' : 'left-0 w-48',
              )}
            >
              <CreateOption icon={StickyNote} label="Nota" onSelect={() => setIsCreateOpen(false)} />
              <CreateOption icon={CheckSquare} label="Acción" onSelect={() => setIsCreateOpen(false)} />
              <CreateOption icon={BookOpen} label="Journal" onSelect={() => setIsCreateOpen(false)} />
              <CreateOption icon={Lightbulb} label="Idea" onSelect={() => setIsCreateOpen(false)} />
            </ul>
          )}
        </div>

        <ul className="space-y-1">
          <li>
            <SidebarButton
              icon={Home}
              label="Inicio"
              isActive={activeView === 'home'}
              isExpanded={isSidebarOpen}
              onClick={() => {
                // /settings is a real Next.js route, not a ui-store view —
                // setView alone never left it. Navigate first so this also
                // works as the "back from Settings/Profile" the topbar
                // needs, then keep activeView in sync for the highlight.
                setView('home')
                router.push('/home')
              }}
            />
          </li>
          <li>
            <SidebarButton
              icon={Inbox}
              label="Procesar"
              count={0}
              isExpanded={isSidebarOpen}
              onClick={() => setToast('No hay nada que procesar.')}
            />
          </li>
          <li>
            <SidebarButton
              icon={CheckCircle2}
              label="Revisar"
              count={0}
              isExpanded={isSidebarOpen}
              onClick={() => setToast('No hay nada que revisar.')}
            />
          </li>
        </ul>

        <div className="flex-grow" />

        <ul className="space-y-1 pb-2">
          <li>
            <SidebarButton
              icon={Trash2}
              label="Papelera"
              isExpanded={isSidebarOpen}
              onClick={() => setToast('La papelera aún no está disponible.')}
            />
          </li>
        </ul>

        <WorkspacePicker
          isExpanded={isSidebarOpen}
          workspaces={workspaces ?? []}
          activeWorkspaceId={activeWorkspaceId}
          activeWorkspaceName={activeWorkspace?.name ?? null}
          onSelect={setActiveWorkspace}
        />
      </nav>

      {toast && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2">
          <div className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
            {toast}
          </div>
        </div>
      )}
    </aside>
  )
}

function CreateOption({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof StickyNote
  label: string
  onSelect: () => void
}) {
  // Every option is meant to open the same centered capture overlay, focused
  // on its own kind (Nota → General, the other three → their type-specific
  // tray) — the spec's "el botón siempre abre el mismo modal". That overlay
  // doesn't accept a "which kind" argument yet: BlockEditor only creates
  // notes so far, since HomeCapture's type-tab logic is being migrated onto
  // it incrementally, one kind at a time. Wiring these four entries to real,
  // distinct creation flows belongs to that migration, not to this menu —
  // so for now every option just closes the menu without fabricating a
  // creation path that isn't there yet.
  return (
    <li role="none">
      <button
        role="menuitem"
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <Icon className="h-4 w-4 text-gray-500" />
        {label}
      </button>
    </li>
  )
}

function SidebarButton({
  icon: Icon,
  label,
  isActive,
  count,
  isExpanded,
  onClick,
}: {
  icon: typeof Home
  label: string
  isActive?: boolean
  count?: number
  isExpanded: boolean
  onClick: () => void
}) {
  const isEmpty = count === 0
  return (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      title={!isExpanded ? label : undefined}
      onClick={onClick}
      className={cn(
        'flex h-11 w-full items-center gap-3 rounded-full text-sm font-medium transition-colors',
        isExpanded ? 'justify-start px-4' : 'justify-center px-0',
        isEmpty && 'text-gray-400 dark:text-gray-500',
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {isExpanded && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {count !== undefined && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs',
                isEmpty ? 'text-gray-300 dark:text-gray-600' : 'bg-primary/10 text-primary',
              )}
            >
              {count}
            </span>
          )}
        </>
      )}
    </Button>
  )
}

interface WorkspacePickerProps {
  isExpanded: boolean
  workspaces: Array<{ id: string; name: string }>
  activeWorkspaceId: string | null
  activeWorkspaceName: string | null
  onSelect: (id: string | null) => void
}

function WorkspacePicker({ isExpanded, workspaces, activeWorkspaceId, activeWorkspaceName, onSelect }: WorkspacePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const select = (id: string | null) => {
    onSelect(id)
    setIsOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Workspace"
        title={!isExpanded ? (activeWorkspaceName ?? 'All workspaces') : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700',
          !isExpanded && 'justify-center',
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
        {isExpanded && (
          <>
            <span className="flex-1 truncate text-left text-gray-700 dark:text-gray-200">
              {activeWorkspaceName ?? 'All workspaces'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </>
        )}
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className={cn(
            'absolute bottom-full z-30 mb-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900',
            isExpanded ? 'left-0 right-0' : 'left-0 w-48',
          )}
        >
          <WorkspaceOption label="All workspaces" isSelected={activeWorkspaceId === null} onSelect={() => select(null)} />
          {workspaces.map((ws) => (
            <WorkspaceOption key={ws.id} label={ws.name} isSelected={activeWorkspaceId === ws.id} onSelect={() => select(ws.id)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function WorkspaceOption({ label, isSelected, onSelect }: { label: string; isSelected: boolean; onSelect: () => void }) {
  return (
    <li role="option" aria-selected={isSelected}>
      <button
        onClick={onSelect}
        className="flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span className="truncate text-gray-700 dark:text-gray-200">{label}</span>
        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
      </button>
    </li>
  )
}
