'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { NotificationHost } from '@/core/notifications/NotificationHost'

// EditNoteModal used to be mounted here — a global editingNote id NoteCard
// wrote to dashboard-store and a separately-mounted component read back out
// to render BlockEditor. That indirection was legacy from when
// BlockEditorModal/EditNoteModal were their own editors needing a shared
// mount point; nothing else ever read editingNote. NoteCard now mounts
// BlockEditor locally, same shape EditableItem already used (nau#153).
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <NotificationHost />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
