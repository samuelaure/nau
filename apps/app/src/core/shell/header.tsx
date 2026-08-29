'use client'

import { Menu } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { cn } from '@9nau/ui/lib/utils'
import { useShellStore } from './shell-store'
import { SearchBar } from '@/core/search/search-bar'

/**
 * The top bar.
 *
 * Deliberately thin. The previous header rendered a granularity picker and a
 * list/columns toggle whenever the current view happened to be "home" —
 * controls belonging to one module's way of showing time, placed in the frame
 * around every module. A control that only makes sense inside one view
 * belongs inside that view, where it can be shown without the shell having to
 * ask which module is on screen.
 */
export function Header({ isScrolled }: { isScrolled: boolean }) {
  const toggleSidebar = useShellStore((s) => s.toggleSidebar)

  return (
    <header
      className={cn(
        'fixed left-0 right-0 top-0 z-30 flex h-16 flex-shrink-0 items-center border-b bg-white px-4 transition-shadow duration-200',
        'dark:border-gray-800 dark:bg-gray-900',
        isScrolled && 'shadow-md',
      )}
    >
      <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
        <Menu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
      </Button>

      <span className="ml-2 text-2xl font-semibold text-gray-700 dark:text-gray-100">9naŭ</span>

      <div className="mx-8 flex-1">
        <SearchBar />
      </div>
    </header>
  )
}
