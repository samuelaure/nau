'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronDown,
  Globe,
  Calendar,
  Lightbulb,
  FileText,
  Users,
  Image,
  Plus,
  Loader2,
  X,
} from 'lucide-react'
import { addBrand } from '@/modules/accounts/actions'

type NauBrand = { id: string; name: string }
type NauWorkspace = { id: string; name: string; brands: NauBrand[] }

const BRAND_NAV = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'profiles', label: 'Profiles', icon: Users },
  { id: 'assets', label: 'Assets', icon: Image },
] as const

export function BrandSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [workspaces, setWorkspaces] = useState<NauWorkspace[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const workspaceMatch = pathname.match(/^\/dashboard\/workspace\/([^/]+)/)
  const activeWorkspaceId = workspaceMatch?.[1] ?? null
  const activeBrandId = searchParams.get('brandId')
  const activeTab = searchParams.get('tab') ?? 'calendar'

  // Whether we're on the workspace main page (vs e.g. /settings sub-route)
  const isOnWorkspacePage = !!activeWorkspaceId && pathname === `/dashboard/workspace/${activeWorkspaceId}`

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NauWorkspace[]) => setWorkspaces(data))
      .catch(() => {})
  }, [])

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
  const activeBrand = activeWorkspace?.brands.find((b) => b.id === activeBrandId)

  const label = activeBrand ? activeBrand.name : activeWorkspace ? 'All Brands' : 'Select Brand'

  const handleCreate = async () => {
    if (!newName.trim() || !activeWorkspaceId) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('brandName', newName.trim())
      fd.append('workspaceId', activeWorkspaceId)
      const brand = await addBrand(fd)
      setWorkspaces((ws) =>
        ws.map((w) =>
          w.id === activeWorkspaceId ? { ...w, brands: [...w.brands, { id: brand.id, name: newName.trim() }] } : w
        )
      )
      setCreating(false)
      setNewName('')
      setOpen(false)
      router.push(`/dashboard/workspace/${activeWorkspaceId}?brandId=${brand.id}`)
    } catch {
      // keep form open on error
    } finally {
      setSaving(false)
    }
  }

  const handleSelect = (brandId: string | null) => {
    setOpen(false)
    if (brandId) {
      // Always go to brand dashboard regardless of current page
      router.push(`/dashboard/workspace/${activeWorkspaceId}?brandId=${brandId}`)
    } else {
      // Always go to workspace overview (even if already there — forces refresh)
      router.push(`/dashboard/workspace/${activeWorkspaceId}`)
    }
  }

  if (!activeWorkspaceId || !activeWorkspace) return null

  return (
    <div className="mb-2">
      {/* Brand dropdown */}
      <div ref={dropdownRef} className="relative mb-1">
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
              onClick={() => handleSelect(null)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-text-secondary"
            >
              All Brands
            </button>
            {activeWorkspace.brands.map((b) => (
              <button
                key={b.id}
                onClick={() => handleSelect(b.id)}
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

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '4px 0' }}>
              {creating ? (
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate()
                      if (e.key === 'Escape') { setCreating(false); setNewName('') }
                    }}
                    placeholder="Brand name"
                    className="w-full text-sm text-white placeholder-gray-500 bg-white/5 border border-white/15 rounded-md px-2.5 py-1.5 outline-none"
                  />
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setCreating(false); setNewName('') }}
                      className="p-1 rounded text-text-secondary hover:bg-white/5 border border-white/10"
                    >
                      <X size={12} />
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={saving || !newName.trim()}
                      className="px-2.5 py-1 rounded text-xs text-white font-medium disabled:opacity-50"
                      style={{ background: 'var(--accent-color)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
                    >
                      {saving ? <Loader2 size={11} className="animate-spin" /> : 'Create'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--accent-color)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Plus size={13} />
                  Create a new Brand
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Brand section nav — only when a brand is active */}
      {activeBrandId && (
        <nav className="flex flex-col gap-0.5">
          {BRAND_NAV.map(({ id, label: navLabel, icon: Icon }) => {
            const isActive = isOnWorkspacePage && activeTab === id
            return (
              <Link
                key={id}
                href={`/dashboard/workspace/${activeWorkspaceId}?brandId=${activeBrandId}&tab=${id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Icon size={15} color={isActive ? 'white' : 'currentColor'} />
                {navLabel}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
