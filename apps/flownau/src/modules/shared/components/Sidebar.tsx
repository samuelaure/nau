'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Video, Instagram, Settings, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

const navItems = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'IG Accounts', href: '/dashboard/accounts', icon: Instagram },
  { name: 'Templates', href: '/dashboard/templates', icon: Video },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
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

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                color: isActive ? 'white' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                transition: 'all 0.2s',
                fontWeight: isActive ? '600' : '400',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Icon size={20} color={isActive ? 'white' : 'currentColor'} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={() => signOut()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '8px',
          color: 'var(--text-secondary)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          marginTop: 'auto',
        }}
      >
        <LogOut size={20} />
        Sign Out
      </button>
    </div>
  )
}
