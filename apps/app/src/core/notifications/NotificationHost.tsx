'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { useNotificationsStore } from './notifications-store'

/**
 * Renders the notification queue as stacked toasts, bottom-right. Mounted
 * once in AppProvider — see notifications-store.ts for why this exists.
 */
export function NotificationHost() {
  const queue = useNotificationsStore((s) => s.queue)
  const dismiss = useNotificationsStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-80 flex-col gap-2">
      {queue.map((n) => (
        <ToastItem key={n.id} id={n.id} message={n.message} tone={n.tone} action={n.action} durationMs={n.durationMs} onDismiss={dismiss} />
      ))}
    </div>
  )
}

function ToastItem({
  id,
  message,
  tone,
  action,
  durationMs,
  onDismiss,
}: {
  id: string
  message: string
  tone: 'error' | 'success' | 'info'
  action?: { label: string; onClick: () => void }
  durationMs: number
  onDismiss: (id: string) => void
}) {
  React.useEffect(() => {
    const t = setTimeout(() => onDismiss(id), durationMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, durationMs])

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
        tone === 'error' && 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/80 dark:text-red-200',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200',
        tone === 'info' && 'border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200',
      )}
    >
      <p className="flex-1">{message}</p>
      {action && (
        <button
          onClick={() => {
            action.onClick()
            onDismiss(id)
          }}
          className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
        >
          {action.label}
        </button>
      )}
      <button onClick={() => onDismiss(id)} aria-label="Cerrar notificación" className="shrink-0 opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
