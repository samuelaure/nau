'use client'

import { Card } from '@/modules/shared/components/ui/Card'
import { ExternalLink, Building2 } from 'lucide-react'

const NAU_SETTINGS_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) || 'https://app.9nau.com'

export default function WorkspacesManager() {
  return (
    <Card className="p-8 mt-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-white/5">
          <Building2 size={24} className="text-accent" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-heading font-semibold mb-1">Workspaces & Brands</h3>
          <p className="text-text-secondary text-sm mb-4">
            Workspace and Brand management has been centralized in the{' '}
            <strong>9naŭ Platform</strong>. Create workspaces, invite members, and register
            brands from there — flownaŭ reads context directly from your active session.
          </p>
          <a
            href={`${NAU_SETTINGS_URL}/settings`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Manage Workspaces & Brands
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </Card>
  )
}
