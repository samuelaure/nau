'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Search as SearchIcon, RefreshCw, LayoutGrid, List, Settings, Moon, Sun, User, LogOut } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { cn } from '@9nau/ui/lib/utils'
import { useShellStore } from './shell-store'
import { useUiStore } from '@/lib/state/ui-store'

const ACCOUNTS_URL = process.env['NEXT_PUBLIC_ACCOUNTS_URL'] ?? 'https://accounts.9nau.com'

/**
 * The top bar. Three groups, each internally clustered, searchbar centered
 * on the whole viewport regardless of how wide the groups either side of it
 * are — an `absolute` + `-translate-x-1/2` box, not a flex `justify-between`
 * child, since the latter centers only in the leftover space.
 */
export function Header({ isScrolled }: { isScrolled: boolean }) {
  const toggleSidebar = useShellStore((s) => s.toggleSidebar)
  const isDarkMode = useShellStore((s) => s.isDarkMode)
  const toggleDarkMode = useShellStore((s) => s.toggleDarkMode)
  const searchQuery = useUiStore((s) => s.searchQuery)
  const setSearchQuery = useUiStore((s) => s.actions.setSearchQuery)
  const notesViewMode = useShellStore((s) => s.notesViewMode)
  const setNotesViewMode = useShellStore((s) => s.setNotesViewMode)
  const router = useRouter()

  return (
    <header
      className={cn(
        'fixed left-0 right-0 top-0 z-30 flex h-16 flex-shrink-0 items-center border-b bg-white px-4 transition-shadow duration-200',
        'dark:border-gray-800 dark:bg-gray-900',
        isScrolled && 'shadow-md',
      )}
    >
      {/* Left group */}
      <div className="flex h-full items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
        </Button>
        <button
          onClick={() => router.push('/home')}
          className="flex items-center text-2xl font-semibold leading-none tracking-tight text-gray-700 dark:text-gray-100"
        >
          naŭ
        </button>
      </div>

      {/* Centered group — centered on the viewport, not the leftover flex space */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
        <div className="pointer-events-auto relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar"
            className="w-full rounded-full border border-transparent bg-gray-100 py-2 pl-9 pr-4 text-sm outline-none transition-colors focus:border-gray-300 focus:bg-white dark:bg-gray-800 dark:focus:bg-gray-900 dark:focus:border-gray-600"
          />
        </div>
      </div>

      {/* Right group */}
      <div className="ml-auto flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Sincronizar" title="Sincronizar (aún no disponible)">
          <RefreshCw className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={notesViewMode === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}
          onClick={() => setNotesViewMode(notesViewMode === 'grid' ? 'list' : 'grid')}
        >
          {notesViewMode === 'grid' ? (
            <List className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <LayoutGrid className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          )}
        </Button>

        <SettingsMenu isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
        <ProfileMenu />
      </div>
    </header>
  )
}

function SettingsMenu({ isDarkMode, toggleDarkMode }: { isDarkMode: boolean; toggleDarkMode: () => void }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const router = useRouter()

  React.useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen])

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => setIsOpen((o) => !o)}>
        <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      </Button>
      {isOpen && (
        <ul className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <li>
            <button
              onClick={() => {
                toggleDarkMode()
                setIsOpen(false)
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {isDarkMode ? <Sun className="h-4 w-4 text-gray-500" /> : <Moon className="h-4 w-4 text-gray-500" />}
              {isDarkMode ? 'Light mode' : 'Dark mode'}
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/settings')
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Settings className="h-4 w-4 text-gray-500" />
              Settings
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

function ProfileMenu() {
  const [isOpen, setIsOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const router = useRouter()

  React.useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen])

  return (
    <div ref={ref} className="relative ml-1">
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Cuenta"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        <User className="h-4 w-4" />
      </button>
      {isOpen && (
        <ul className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <li>
            {/* Profile page (display name / email / password) doesn't exist
                yet — this only routes to /settings as the nearest real
                content surface until a dedicated profile panel is built. */}
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/settings')
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <User className="h-4 w-4 text-gray-500" />
              Profile
            </button>
          </li>
          <li>
            <a
              href={`${ACCOUNTS_URL}/logout`}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </a>
          </li>
        </ul>
      )}
    </div>
  )
}
