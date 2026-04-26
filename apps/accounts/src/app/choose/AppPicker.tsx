'use client'

import { Video, Zap, LayoutDashboard, LogOut } from 'lucide-react'

const APPS = [
  {
    key: 'app',
    name: '9naŭ',
    description: 'Notes, actions, journal — your personal platform dashboard.',
    icon: LayoutDashboard,
    url: process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://app.9nau.com',
    color: '#7c3aed',
  },
  {
    key: 'flownau',
    name: 'flownaŭ',
    description: 'AI-powered video content pipeline for your brands.',
    icon: Video,
    url: process.env['NEXT_PUBLIC_FLOWNAU_URL'] ?? 'https://flow.9nau.com',
    color: '#0ea5e9',
  },
  {
    key: 'nauthenticity',
    name: 'naŭthenticity',
    description: 'Brand DNA, target monitoring, and smart comment engagement.',
    icon: Zap,
    url: process.env['NEXT_PUBLIC_NAUTHENTICITY_URL'] ?? 'https://nauthenticity.9nau.com',
    color: '#10b981',
  },
]

export function AppPicker() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top_right,#1e1b4b,#000)] p-6 gap-10">
      <div className="text-center">
        <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(124,58,237,0.5)]">
          <span className="text-white text-xl font-bold font-heading">9</span>
        </div>
        <h1 className="text-3xl font-heading font-bold mb-2">Where to?</h1>
        <p className="text-white/50 text-sm">Choose an app to continue.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
        {APPS.map(({ key, name, description, icon: Icon, url, color }) => (
          <a
            key={key}
            href={url}
            className="glass flex flex-col gap-3 p-6 rounded-2xl hover:scale-[1.02] transition-transform cursor-pointer no-underline"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${color}22`, border: `1px solid ${color}44` }}
            >
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <p className="font-semibold text-white text-base mb-1">{name}</p>
              <p className="text-white/50 text-sm leading-snug">{description}</p>
            </div>
          </a>
        ))}
      </div>

      <a
        href="/api/auth/logout"
        className="flex items-center gap-2 text-white/30 hover:text-white/60 text-sm transition-colors"
      >
        <LogOut size={14} /> Sign out
      </a>

      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/10 blur-[150px] -z-10 rounded-full pointer-events-none" />
    </div>
  )
}
