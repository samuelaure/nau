'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, Video } from 'lucide-react'
import Sidebar from './Sidebar'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Close sidebar whenever the route changes
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar — hidden on desktop */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/95 backdrop-blur-sm">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-accent rounded-lg">
            <Video size={15} color="white" />
          </div>
          <span className="font-extrabold text-base lowercase" style={{ fontFamily: 'Outfit' }}>
            flownaŭ
          </span>
        </div>
      </header>

      {/* Backdrop overlay — mobile only */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <main className="flex flex-col gap-6 w-full min-h-screen md:ml-[320px] px-4 pt-20 pb-8 md:px-10 md:pt-10 md:pb-10">
        {children}
      </main>
    </div>
  )
}
