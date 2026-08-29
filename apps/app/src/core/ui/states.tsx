'use client'

import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@9nau/ui/components/button'
import { cn } from '@9nau/ui/lib/utils'

/**
 * The three states every asynchronous surface has, in one place.
 *
 * Each view previously wrote its own — a centred grey div for loading, a red
 * div for failure, an italic line for empty — so they drifted in wording,
 * spacing and colour, and none of them offered a way to retry. A module
 * should not have to decide what a failure looks like.
 */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 py-16 text-center"
    >
      <AlertCircle className="h-6 w-6 text-red-500" aria-hidden />
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{title}</p>
        {message && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  message,
  action,
  className,
}: {
  title: string
  message?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{title}</p>
        {message && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>}
      </div>
      {action}
    </div>
  )
}
