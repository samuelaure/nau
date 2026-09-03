'use client'

import { BlockToolbar } from './BlockToolbar'

/**
 * The entire bottom-edge row a block carries — not just the buttons
 * (`BlockToolbar`), the row itself: `BlockToolbar` alongside the error slot
 * and the optional "Cerrar".
 *
 * `NoteCard`'s on-hover row and `BlockEditor`'s open editor both render
 * this exact component now — abstracting only `BlockToolbar` still let the
 * two drift apart in practice: `BlockToolbar`'s own root had no `flex-1`,
 * so inside a plain flex row it shrank to its content instead of filling
 * the space available to it, and its internal `ml-auto` (meant to push
 * `MoreVertical` to the far right) had nothing to push against —
 * `MoreVertical` ended up sitting flush against the disabled icons instead
 * of at the row's right edge. Fixed at the source: `BlockToolbar` itself
 * now takes `flex-1`, so it (and this component) work correctly as a
 * direct flex child wherever they're mounted, with no extra wrapper div
 * needed at either call site to make the layout behave.
 */
export function BlockBottomBar({
  isHabit,
  onDelete,
  canDelete = true,
  showClose = true,
  onClose,
  errorMessage,
}: {
  isHabit?: boolean
  onDelete: () => void
  canDelete?: boolean
  /** `NoteCard`'s on-hover row passes `false` — nothing is open, so there is nothing to close. */
  showClose?: boolean
  /** Required when `showClose` is true. */
  onClose?: () => void
  errorMessage?: string | null
}) {
  return (
    <div className="flex items-center gap-3">
      <BlockToolbar isHabit={isHabit} onDelete={onDelete} canDelete={canDelete} />

      {errorMessage && <span className="text-xs text-red-600">{errorMessage}</span>}

      {showClose && (
        <button
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cerrar
        </button>
      )}
    </div>
  )
}
