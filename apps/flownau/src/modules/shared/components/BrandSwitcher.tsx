'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronDown,
  Globe,
  Calendar,
  Lightbulb,
  Layers,
  FileText,
  Users,
  Image,
  Video,
} from 'lucide-react'

type NauBrand = { id: string; name: string }
type NauWorkspace = { id: string; name: string; brands: NauBrand[] }

const BRAND_NAV = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'pool', label: 'Pool', icon: Layers },
  { id: 'compositions', label: 'Compositions', icon: Video },
  { id: 'profiles', label: 'Profiles', icon: Users },
  { id: 'assets', label: 'Assets', icon: Image },
] as const

export function BrandSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [workspaces, setWorkspaces] = useState<NauWorkspace[]>([])
  const [open, setOpen] = useState(false)

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
      <div className="relative mb-1">
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
