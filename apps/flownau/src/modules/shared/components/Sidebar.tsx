'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Video,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Check,
  Loader2,
  X,
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

type NauWorkspace = { id: string; name: string }

// ─── Workspace selector ───────────────────────────────────────────────────────

function WorkspaceSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const [workspaces, setWorkspaces] = useState<NauWorkspace[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Derive active workspace from URL
  const workspaceMatch = pathname.match(/^\/dashboard\/workspace\/([^/]+)/)
  const activeWorkspaceId = workspaceMatch?.[1] ?? null
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NauWorkspace[]) => setWorkspaces(data))
      .catch(() => {})
  }, [])

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error()
      const created: NauWorkspace = await res.json()
      setWorkspaces((ws) => [...ws, created])
      setCreating(false)
      setNewName('')
      setOpen(false)
      router.push(`/dashboard/workspace/${created.id}`)
    } catch {
      // toast not available here without import — silently fail for now
    } finally {
      setSaving(false)
    }
  }

  const label = activeWorkspace?.name ?? 'Select workspace'

  return (
    <div ref={dropdownRef} className="relative mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'white',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          gap: '8px',
        }}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            zIndex: 100,
            background: 'var(--panel-bg, #1a1a2e)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                setOpen(false)
                router.push(`/dashboard/workspace/${ws.id}`)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                color: ws.id === activeWorkspaceId ? 'white' : 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: ws.id === activeWorkspaceId ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span className="truncate">{ws.name}</span>
              {ws.id === activeWorkspaceId && (
                <Check size={13} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
              )}
            </button>
          ))}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '4px 0' }}>
            {creating ? (
              <div
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') setCreating(false)
                  }}
                  placeholder="Workspace name"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                    width: '100%',
                  }}
                />
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setCreating(false)
                      setNewName('')
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={12} />
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !newName.trim()}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'var(--accent-color)',
                      border: 'none',
                      color: 'white',
                      fontSize: '12px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {saving ? <Loader2 size={11} className="animate-spin" /> : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-color)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <Plus size={14} />
                Create a new workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const navItems = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()

  // If inside a workspace, Overview should point to that workspace
  const workspaceMatch = pathname.match(/^\/dashboard\/workspace\/([^/]+)/)
  const workspaceId = workspaceMatch?.[1] ?? null

  const resolvedItems = navItems.map((item) => {
    if (item.name === 'Overview' && workspaceId) {
      return { ...item, href: `/dashboard/workspace/${workspaceId}` }
    }
    if (item.name === 'Settings' && workspaceId) {
      return { ...item, href: `/dashboard/workspace/${workspaceId}/settings` }
    }
    return item
  })

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div
      className="glass"
      style={{
        width: '280px',
        height: 'calc(100vh - 40px)',
        margin: '20px',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        position: 'fixed',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{ padding: '8px', background: 'var(--accent-color)', borderRadius: '8px' }}>
          <Video size={20} color="white" />
        </div>
        <span
          style={{
            fontWeight: '800',
            fontSize: '20px',
            fontFamily: 'Outfit',
            textTransform: 'lowercase',
          }}
        >
          flownaŭ
        </span>
      </div>

      {/* Workspace selector */}
      <WorkspaceSelector />

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {resolvedItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.name === 'Overview'
              ? pathname === item.href || pathname.startsWith(item.href + '/')
              : pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                color: isActive ? 'white' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                transition: 'all 0.2s',
                fontWeight: isActive ? '600' : '400',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Icon size={18} color={isActive ? 'white' : 'currentColor'} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={handleSignOut}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 12px',
          borderRadius: '8px',
          color: 'var(--text-secondary)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        <LogOut size={18} />
        Sign Out
      </button>
    </div>
  )
}
