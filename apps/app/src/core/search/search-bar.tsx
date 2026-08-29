'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search as SearchIcon, Loader2 } from 'lucide-react'
import { Input } from '@9nau/ui/components/input'
import { searchAllModules } from '@/core/module-registry/registry'
import type { SearchResult } from '@/core/module-registry/contract'

/**
 * Search as a core capability.
 *
 * The core owns the input, the debounce, the fan-out and the rendering of a
 * result; each module owns knowing how to search its own content and what a
 * result of its kind looks like. Nothing here knows a journal entry from an
 * action — it renders `SearchResult`, whatever produced it.
 *
 * The view this replaces held a hardcoded union of every module's block
 * types as filter options, so adding a module meant editing search, and a
 * module switched off still offered its filter.
 */
const DEBOUNCE_MS = 250

export function SearchBar() {
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    // Guards against an earlier, slower query overwriting a later one's
    // results — the classic out-of-order response bug in a search box.
    let cancelled = false

    const timer = setTimeout(async () => {
      try {
        const found = await searchAllModules(trimmed, { enabledModuleIds: [] })
        if (!cancelled) setResults(found)
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  React.useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
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

  const showPanel = isOpen && query.trim().length > 0

  return (
    <div ref={containerRef} className="relative mx-auto max-w-2xl">
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder="Search…"
        aria-label="Search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="search-results"
        className="w-full rounded-lg border-transparent bg-gray-100 pl-12 pr-10 focus:bg-white focus:shadow-md dark:bg-gray-800 dark:focus:bg-gray-900"
      />
      {isSearching && (
        <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
      )}

      {showPanel && (
        <div
          id="search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {results.length === 0 && !isSearching ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">No results</p>
          ) : (
            <ul>
              {results.map((result) => (
                <li key={result.id} role="option" aria-selected={false}>
                  <Link
                    href={result.href}
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="block truncate text-sm text-gray-800 dark:text-gray-100">
                      {result.title}
                    </span>
                    {result.subtitle && (
                      <span className="block truncate text-xs text-gray-500">{result.subtitle}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
