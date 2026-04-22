'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Globe } from 'lucide-react'

type NauBrand = { id: string; name: string }
type NauWorkspace = { id: string; name: string; brands: NauBrand[] }

const NAU_API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_NAU_API_URL) || 'https://api.9nau.com'

export function BrandSwitcher() {
  const [workspaces, setWorkspaces] = useState<NauWorkspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch(`${NAU_API_URL}/workspaces`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NauWorkspace[]) => {
        setWorkspaces(data)
        if (data.length > 0) setActiveWorkspaceId(data[0].id)
      })
      .catch(() => {})
  }, [])

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
  const activeBrand = activeWorkspace?.brands.find((b) => b.id === activeBrandId)

  const label = activeBrand
    ? `${activeWorkspace?.name} / ${activeBrand.name}`
    : activeWorkspace
      ? `${activeWorkspace.name} / All Brands`
      : 'Select Brand'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-white hover:text-accent transition-colors"
      >
        <Globe size={16} className="text-text-secondary" />
        <span>{label}</span>
        <ChevronDown size={14} className="text-text-secondary" />
      </button>

      {open && (
        <div className="absolute top-8 left-0 z-50 bg-panel border border-white/10 rounded-xl shadow-xl w-72 overflow-hidden">
          {workspaces.map((ws) => (
            <div key={ws.id}>
              <button
                onClick={() => {
                  setActiveWorkspaceId(ws.id)
                  setActiveBrandId(null)
                  setOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-white/5 transition-colors ${
                  activeWorkspaceId === ws.id ? 'text-accent' : 'text-text-secondary'
                }`}
              >
                {ws.name}
              </button>
              {ws.brands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setActiveWorkspaceId(ws.id)
                    setActiveBrandId(b.id)
                    setOpen(false)
                  }}
                  className={`w-full text-left pl-8 pr-4 py-2 text-sm hover:bg-white/5 transition-colors ${
                    activeBrandId === b.id ? 'text-white' : 'text-text-secondary'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          ))}
          {workspaces.length === 0 && (
            <p className="px-4 py-3 text-sm text-text-secondary">No workspaces found.</p>
          )}
        </div>
      )}
    </div>
  )
}
