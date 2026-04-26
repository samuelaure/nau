'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'

export default function AccountTemplates({ brandId }: { brandId: string }) {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`/api/account-templates?brandId=${brandId}`)
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [brandId])

  const updateConfig = async (
    templateId: string,
    patch: { autoApprovePost?: boolean; enabled?: boolean },
  ) => {
    try {
      const res = await fetch('/api/account-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, templateId, ...patch }),
      })
      if (!res.ok) throw new Error()
      toast.success('Updated')
      fetchTemplates()
    } catch {
      toast.error('Failed to update template config')
    }
  }

  const toggleScope = async (templateId: string, currentScope: string) => {
    const newScope = currentScope === 'workspace' ? 'account' : 'workspace'
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: newScope }),
      })
      if (!res.ok) throw new Error()
      toast.success(newScope === 'workspace' ? 'Shared with workspace' : 'Set to account-only')
      fetchTemplates()
    } catch {
      toast.error('Failed to update scope')
    }
  }

  if (loading) return <p className="text-text-secondary text-sm">Loading...</p>

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-xl font-heading font-semibold">Templates</h2>
        <p className="text-text-secondary text-sm mt-1">
          Manage which templates are enabled for this account and configure auto-publishing per
          template.
        </p>
      </div>

      <div className="grid gap-4">
        {templates.map((t) => {
          const config = t.brandConfigs?.[0]
          const isOwn = t.brandId === brandId
          const isEnabled = config?.enabled ?? false
          const autoApprovePost = config?.autoApprovePost ?? false

          return (
            <Card key={t.id} className="p-5">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{t.name}</h3>
                    {!isOwn && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                        Shared
                      </span>
                    )}
                    {isOwn && t.scope === 'workspace' && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                        Public
                      </span>
                    )}
                    {t.sceneType && (
                      <span className="text-[10px] text-gray-500">{t.sceneType}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => updateConfig(t.id, { enabled: e.target.checked })}
                        className="w-4 h-4 accent-accent"
                      />
                      Enabled for this account
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm">
                      <input
                        type="checkbox"
                        checked={autoApprovePost}
                        onChange={(e) => updateConfig(t.id, { autoApprovePost: e.target.checked })}
                        className="w-4 h-4 accent-green-400"
                      />
                      Auto-post (skip Final Review)
                    </label>
                  </div>
                </div>

                {isOwn && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs"
                    onClick={() => toggleScope(t.id, t.scope)}
                  >
                    {t.scope === 'workspace' ? 'Make private' : 'Share with workspace'}
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
        {templates.length === 0 && (
          <p className="text-text-secondary text-sm">
            No templates found. Create templates via the API or enable workspace-shared templates.
          </p>
        )}
      </div>
    </div>
  )
}
