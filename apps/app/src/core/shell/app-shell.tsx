'use client'

import * as React from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { TelegramLinkBanner } from '@9nau/ui'
import { cn } from '@9nau/ui/lib/utils'
import { Header } from './header'
import { Sidebar } from './sidebar'
import { useShellStore } from './shell-store'
import { useWorkspaceStore } from '@/core/identity/workspace-store'
import { useNotesViewStore } from '@/components/notes/notes-view-store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.9nau.com'
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'zazu_bot'

/**
 * The frame every module renders inside.
 *
 * What it deliberately no longer does: hold a ref to "today" and a view mode
 * in order to offer a "go to today" button. Those belong to the module that
 * has a notion of today — the shell cannot know whether the thing on screen
 * has one. Scrolling back to the top is genuinely the frame's, because the
 * frame owns the scroll container.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const isSidebarOpen = useShellStore((s) => s.isSidebarOpen)
  const isDarkMode = useShellStore((s) => s.isDarkMode)
  const hydrateFromStorage = useShellStore((s) => s.hydrateFromStorage)
  const hydrateWorkspaceFromStorage = useWorkspaceStore((s) => s.hydrateFromStorage)
  const hydrateNotesViewFromStorage = useNotesViewStore((s) => s.hydrateFromStorage)

  const mainRef = React.useRef<HTMLDivElement>(null)
  const [isScrolled, setIsScrolled] = React.useState(false)

  // All three stores always start at their SSR-safe default (see
  // shell-store.ts, workspace-store.ts, notes-view-store.ts); this pulls in
  // whatever was actually persisted, once, after the first paint is already
  // committed and matched against the server's markup. Centralized here
  // rather than left to whichever component happens to read a given store
  // first — notes-view-store's hydration used to live inside
  // BandejaControls' GroupBySelector, which only worked because it always
  // happened to mount alongside BandejaGeneral (the actual reader of
  // groupBy); a layout that split them would have silently stuck
  // BandejaGeneral on the SSR default forever.
  React.useEffect(() => {
    hydrateFromStorage()
    hydrateWorkspaceFromStorage()
    hydrateNotesViewFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reacts to isDarkMode changing after that — either from hydration just
  // above, or a later manual toggle. Doing this inside the store would make
  // constructing/updating it a side effect on the DOM.
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  React.useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const onScroll = () => setIsScrolled(el.scrollTop > 10)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="flex h-screen flex-col bg-white font-sans text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <TelegramLinkBanner apiUrl={API_URL} botUsername={BOT_USERNAME} />
      <Header isScrolled={isScrolled} />
      <div className="flex flex-1 overflow-hidden pt-16">
        <Sidebar />
        <main
          ref={mainRef}
          className={cn(
            'flex-1 overflow-y-auto bg-white transition-all duration-300 dark:bg-gray-950',
          )}
          style={{ marginLeft: isSidebarOpen ? '256px' : '80px' }}
        >
          {children}
        </main>
      </div>

      {isScrolled && (
        <Button
          onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          size="icon"
          aria-label="Back to top"
          className="fixed bottom-8 right-8 z-50 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
        >
          <ArrowUp className="h-6 w-6" />
        </Button>
      )}
    </div>
  )
}
