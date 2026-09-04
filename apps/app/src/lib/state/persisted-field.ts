/**
 * One rule, three stores: `shell-store.ts` (theme, notes view mode),
 * `notes-view-store.ts` (group-by), `workspace-store.ts` (active workspace)
 * each persist a field to `localStorage` and each need the same two-step
 * dance to do it without a hydration mismatch — reading `localStorage`
 * inside `create()`'s initializer runs at module-evaluation time, before
 * React reconciles the first client render against the server's markup
 * (which has no `localStorage` access), so the store must start at an
 * SSR-safe default and only pick up the real persisted value from a
 * `hydrateFromStorage()` called post-mount, once first paint is already
 * committed and matched.
 *
 * This used to be hand-rolled three times, each with its own read/validate
 * logic and its own drift: one store's `hydrateFromStorage` skipped
 * validating the stored value entirely, trusting whatever localStorage held
 * verbatim. `readPersisted` is the one place that reads and validates —
 * every store still owns its own `set()` call and default, since those
 * differ per field, but the storage-read half is no longer copy-pasted.
 *
 * Only for enum-shaped fields with a non-null fallback (theme, view mode,
 * group-by) — `workspace-store.ts`'s `activeWorkspaceId` is `string | null`
 * with no fixed set of valid values, so it validates and defaults inline
 * instead of forcing that shape through here.
 */
export function readPersisted<T extends string>(key: string, isValid: (value: string) => value is T, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const stored = localStorage.getItem(key)
  return stored !== null && isValid(stored) ? stored : fallback
}
