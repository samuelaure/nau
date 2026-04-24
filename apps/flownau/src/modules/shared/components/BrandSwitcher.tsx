'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Globe } from 'lucide-react'

type NauBrand = { id: string; name: string }
type NauWorkspace = { id: string; name: string; brands: NauBrand[] }

const NAU_API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_NAU_API_URL) || 'https://api.9nau.com'

export function BrandSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [workspaces, setWorkspaces] = useState<NauWorkspace[]>([])
  const [open, setOpen] = useState(false)

  // Derive active workspace from URL path
  const workspaceMatch = pathname.match(/^\/dashboard\/workspace\/([^/]+)/)
  const activeWorkspaceId = workspaceMatch?.[1] ?? null

  // Active brand from URL query param
  const activeBrandId = searchParams.get('brandId')

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NauWorkspace[]) => setWorkspaces(data))
      .catch(() => {})
  }, [])

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
  const activeBrand = activeWorkspace?.brands.find((b) => b.id === activeBrandId)

  const label = activeBrand
    ? `${activeBrand.name}`
    : activeWorkspace
      ? 'All Brands'
      : 'Select Brand'

  const setActiveBrand = (brandId: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (brandId) {
      params.set('brandId', brandId)
    } else {
      params.delete('brandId')
    }
    router.replace(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  // Only show if we're inside a workspace
  if (!activeWorkspaceId || !activeWorkspace) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-white hover:text-accent transition-colors w-full px-3 py-2 rounded-lg hover:bg-white/5"
      >
        <Globe size={16} className="text-text-secondary shrink-0" />
        <span className="truncate flex-1 text-left">{label}</span>
        <ChevronDown size={14} className="text-text-secondary shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-panel border border-white/10 rounded-xl shadow-xl overflow-hidden">
          <button
            onClick={() => setActiveBrand(null)}
            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
              !activeBrandId ? 'text-accent font-semibold' : 'text-text-secondary'
            }`}
          >
            All Brands
          </button>
          {activeWorkspace.brands.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBrand(b.id)}
              className={`w-full text-left pl-6 pr-4 py-2 text-sm hover:bg-white/5 transition-colors ${
                activeBrandId === b.id ? 'text-white font-medium' : 'text-text-secondary'
              }`}
            >
              {b.name}
            </button>
          ))}
          {activeWorkspace.brands.length === 0 && (
            <p className="px-4 py-3 text-sm text-text-secondary">No brands in this workspace.</p>
          )}
        </div>
      )}
    </div>
  )
}
