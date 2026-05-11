'use client'

import * as React from 'react'
import { useUiStore, useUiActions, View } from '@/lib/state/ui-store'
import { cn } from '@9nau/ui/lib/utils'
import { Button } from '@9nau/ui/components/button'
import {
  Home, Inbox, Zap, Coffee, Trash2, Archive, BookOpen, Search,
  Moon, Sun, Settings, FolderOpen, ChevronDown, Check, Building2,
} from 'lucide-react'
import Link from 'next/link'
import { useUpdateBlock } from '@/hooks/use-blocks-api'
import { useGetWorkspaces } from '@/hooks/use-workspaces-api'

const NAV_ITEMS: Array<{ key: View; icon: React.ElementType; title: string }> = [
  { key: 'home',         icon: Home,       title: 'Home' },
  { key: 'inbox',        icon: Inbox,       title: 'Inbox' },
  { key: 'actions',      icon: Zap,         title: 'Actions' },
  { key: 'projects',     icon: FolderOpen,  title: 'Projects' },
  { key: 'journal',      icon: BookOpen,    title: 'Journal' },
  { key: 'experiences',  icon: Coffee,      title: 'Experiences' },
  { key: 'information',  icon: Archive,     title: 'Information' },
  { key: 'search',       icon: Search,      title: 'Search' },
]

export function Sidebar() {
  const isSidebarOpen = useUiStore((s) => s.isSidebarOpen)
  const activeView = useUiStore((s) => s.activeView)
  const isDarkMode = useUiStore((s) => s.isDarkMode)
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId)
  const { setView, toggleDarkMode, setActiveWorkspace } = useUiActions()
  const updateBlock = useUpdateBlock()
  const { data: workspaces } = useGetWorkspaces()

  const [isHoverExpanded, setIsHoverExpanded] = React.useState(false)
  const [wsDropdownOpen, setWsDropdownOpen] = React.useState(false)
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const wsDropdownRef = React.useRef<HTMLDivElement>(null)

  const isExpanded = isSidebarOpen || isHoverExpanded

  const activeWorkspace = workspaces?.find((w) => w.id === activeWorkspaceId) ?? null

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target as Node)) {
        setWsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    if (!isSidebarOpen) setIsHoverExpanded(true)
  }

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setIsHoverExpanded(false), 150)
  }

  const handleNoteDrop = (noteId: string, status: View) => {
    if (status === 'home') return
    updateBlock.mutate({ id: noteId, updateDto: { properties: { status } } })
  }

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-r dark:border-gray-800 transition-all duration-300 ease-in-out z-20',
        isExpanded ? 'w-72 shadow-lg' : 'w-20'
      )}
    >
      <nav className="p-2 pt-3 flex flex-col h-full">

        {/* Workspace dropdown */}
        <div ref={wsDropdownRef} className="relative mb-3">
          <button
            onClick={() => isExpanded && setWsDropdownOpen((o) => !o)}
            className={cn(
              'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700',
              !isExpanded && 'justify-center px-0'
            )}
          >
            <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
            {isExpanded && (
              <>
                <span className="flex-1 truncate text-left text-gray-700 dark:text-gray-200">
                  {activeWorkspace?.name ?? 'All workspaces'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              </>
            )}
          </button>

          {wsDropdownOpen && isExpanded && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
              <button
                onClick={() => { setActiveWorkspace(null); setWsDropdownOpen(false) }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-gray-700 dark:text-gray-200">All workspaces</span>
                {activeWorkspaceId === null && <Check className="h-3.5 w-3.5 text-blue-500" />}
              </button>
              {(workspaces ?? []).map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => { setActiveWorkspace(ws.id); setWsDropdownOpen(false) }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-gray-700 dark:text-gray-200 truncate">{ws.name}</span>
                  {activeWorkspaceId === ws.id && <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main nav */}
        <ul className="flex-grow space-y-1">
          {NAV_ITEMS.map(({ key, icon, title }) => (
            <SidebarItem
              key={key}
              viewKey={key}
              icon={icon}
              title={title}
              isActive={activeView === key}
              isExpanded={isExpanded}
              onClick={() => setView(key)}
              onDrop={handleNoteDrop}
            />
          ))}
        </ul>

        {/* Bottom controls */}
        <ul className="space-y-1 pb-2">
          <li>
            <Button
              variant="ghost"
              className={cn(
                'w-full flex items-center h-12 text-sm font-medium transition-colors',
                isExpanded ? 'justify-start px-4' : 'justify-center'
              )}
              onClick={toggleDarkMode}
            >
              {isDarkMode
                ? <Sun className={cn('h-5 w-5', isExpanded && 'mr-4')} />
                : <Moon className={cn('h-5 w-5', isExpanded && 'mr-4')} />}
              {isExpanded && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
            </Button>
          </li>
          <SidebarItem
            viewKey="trash"
            icon={Trash2}
            title="Trash"
            isActive={activeView === 'trash'}
            isExpanded={isExpanded}
            onClick={() => setView('trash')}
            onDrop={handleNoteDrop}
          />
          <li>
            <Link href="/settings" passHref legacyBehavior>
              <Button
                variant="ghost"
                className={cn(
                  'w-full flex items-center h-12 text-sm font-medium transition-colors',
                  isExpanded ? 'justify-start px-4' : 'justify-center'
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

interface SidebarItemProps {
  icon: React.ElementType
  title: string
  isActive: boolean
  isExpanded: boolean
  onClick: () => void
  onDrop: (noteId: string, status: View) => void
  viewKey: View
}

function SidebarItem({ icon: Icon, title, isActive, isExpanded, onClick, onDrop, viewKey }: SidebarItemProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  return (
    <li>
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        className={cn(
          'w-full flex items-center h-12 text-sm font-medium transition-colors',
          isExpanded ? 'justify-start px-4' : 'justify-center',
          isDragOver && 'bg-blue-100'
        )}
        onClick={onClick}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          const noteId = e.dataTransfer.getData('text/plain')
          if (noteId) onDrop(noteId, viewKey)
        }}
      >
        <Icon className={cn('h-6 w-6', isExpanded && 'mr-4')} />
        {isExpanded && <span>{title}</span>}
      </Button>
    </li>
  )
}
