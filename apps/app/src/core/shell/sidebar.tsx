'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Moon, Sun, Settings, Building2, ChevronDown, Check } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { cn } from '@9nau/ui/lib/utils'
import { useShellStore } from './shell-store'
import { useWorkspaceStore } from '@/core/identity/workspace-store'
import { useGetWorkspaces } from '@/core/identity/use-workspaces'
import { getNavEntries } from '@/core/module-registry/registry'

/**
 * The navigation frame.
 *
 * Its entries come from the module registry, not from a list written here.
 * The previous sidebar held a literal `NAV_ITEMS` array naming every view,
 * which meant the shell could not render without knowing what a journal or
 * an agenda was, and switching a module off meant editing this file.
 *
 * It also accepted dropped notes to re-file them by status — a References
 * concern reaching into the shell. Dropping onto navigation is a reasonable
 * interaction, but it belongs to whichever module owns the thing being
 * dragged, so it is not reinstated here; a module that wants it can declare
 * a drop target through its own descriptor once there is a second case to
 * generalise from.
 */
export function Sidebar() {
  const isSidebarOpen = useShellStore((s) => s.isSidebarOpen)
  const isDarkMode = useShellStore((s) => s.isDarkMode)
  const toggleDarkMode = useShellStore((s) => s.toggleDarkMode)

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const { data: workspaces } = useGetWorkspaces()

  const pathname = usePathname()
  const [isHoverExpanded, setIsHoverExpanded] = React.useState(false)
  const hoverTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const isExpanded = isSidebarOpen || isHoverExpanded
  const activeWorkspace = workspaces?.find((w) => w.id === activeWorkspaceId) ?? null

  // Which modules this workspace has switched on. Until the backend reports
  // it, every registered module is treated as enabled — the mechanism is in
  // place, and the data that drives it is a separate contract.
  const navEntries = getNavEntries({ enabledModuleIds: [] })

  React.useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    }
  }, [])

  const handleMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    if (!isSidebarOpen) setIsHoverExpanded(true)
  }

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setIsHoverExpanded(false), 150)
  }

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'fixed top-16 left-0 h-[calc(100vh-4rem)] border-r bg-white transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 z-20',
        isExpanded ? 'w-72 shadow-lg' : 'w-20',
      )}
    >
      <nav className="flex h-full flex-col p-2 pt-3">
        <WorkspacePicker
          isExpanded={isExpanded}
          workspaces={workspaces ?? []}
          activeWorkspaceId={activeWorkspaceId}
          activeWorkspaceName={activeWorkspace?.name ?? null}
          onSelect={setActiveWorkspace}
        />

        <ul className="flex-grow space-y-1">
          {navEntries.map(({ moduleId, label, icon: Icon, href }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={moduleId}>
                <Link href={href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex h-12 w-full items-center text-sm font-medium transition-colors',
                      isExpanded ? 'justify-start px-4' : 'justify-center',
                    )}
                  >
                    <Icon className={cn('h-6 w-6', isExpanded && 'mr-4')} />
                    {isExpanded && <span>{label}</span>}
                  </Button>
                </Link>
              </li>
            )
          })}
        </ul>

        <ul className="space-y-1 pb-2">
          <li>
            <Button
              variant="ghost"
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={cn(
                'flex h-12 w-full items-center text-sm font-medium transition-colors',
                isExpanded ? 'justify-start px-4' : 'justify-center',
              )}
            >
              {isDarkMode ? (
                <Sun className={cn('h-5 w-5', isExpanded && 'mr-4')} />
              ) : (
                <Moon className={cn('h-5 w-5', isExpanded && 'mr-4')} />
              )}
              {isExpanded && <span>{isDarkMode ? 'Light mode' : 'Dark mode'}</span>}
            </Button>
          </li>
          <li>
            <Link href="/settings">
              <Button
                variant={pathname.startsWith('/settings') ? 'secondary' : 'ghost'}
                className={cn(
                  'flex h-12 w-full items-center text-sm font-medium transition-colors',
                  isExpanded ? 'justify-start px-4' : 'justify-center',
                )}
              >
                <Settings className={cn('h-5 w-5', isExpanded && 'mr-4')} />
                {isExpanded && <span>Settings</span>}
              </Button>
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  )
}

interface WorkspacePickerProps {
  isExpanded: boolean
  workspaces: Array<{ id: string; name: string }>
  activeWorkspaceId: string | null
  activeWorkspaceName: string | null
  onSelect: (id: string | null) => void
}

function WorkspacePicker({
  isExpanded,
  workspaces,
  activeWorkspaceId,
  activeWorkspaceName,
  onSelect,
}: WorkspacePickerProps) {
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
    <div ref={ref} className="relative mb-3">
      <button
        onClick={() => isExpanded && setIsOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700',
          !isExpanded && 'justify-center px-0',
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

      {isOpen && isExpanded && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <WorkspaceOption
            label="All workspaces"
            isSelected={activeWorkspaceId === null}
            onSelect={() => select(null)}
          />
          {workspaces.map((ws) => (
            <WorkspaceOption
              key={ws.id}
              label={ws.name}
              isSelected={activeWorkspaceId === ws.id}
              onSelect={() => select(ws.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function WorkspaceOption({
  label,
  isSelected,
  onSelect,
}: {
  label: string
  isSelected: boolean
  onSelect: () => void
}) {
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
