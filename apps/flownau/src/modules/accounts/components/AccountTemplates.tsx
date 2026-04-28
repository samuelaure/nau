'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { installDefaultTemplates } from '@/modules/accounts/actions'

export default function AccountTemplates({
  brandId,
  workspaceId,
}: {
  brandId: string
  workspaceId?: string
}) {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)

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

  const handleInstallDefaults = async () => {
    setInstalling(true)
    try {
      const result = await installDefaultTemplates(brandId)
      if (result.installed === 0) {
        toast.info('Default templates are already installed')
      } else {
        toast.success(`Installed ${result.installed} default template${result.installed > 1 ? 's' : ''}`)
        fetchTemplates()
      }
    } catch {
      toast.error('Failed to install default templates')
    } finally {
      setInstalling(false)
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-semibold">Templates</h2>
          <p className="text-text-secondary text-sm mt-1">
            Manage which templates are enabled for this account and configure auto-publishing per
            template.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleInstallDefaults}
          disabled={installing}
          className="shrink-0 text-xs"
        >
          {installing ? 'Installing…' : '+ Install defaults'}
        </Button>
      </div>

      <div className="grid gap-4">
        {templates.map((t) => {
          const config = t.brandConfigs?.[0]
          const isOwn = t.brandId === brandId
          const isEnabled = config?.enabled ?? false
          const autoApprovePost = config?.autoApprovePost ?? false

          const detailUrl = workspaceId
            ? `/dashboard/workspace/${workspaceId}/template/${t.id}?brandId=${brandId}`
            : null

          return (
            <Card key={t.id} className="p-5 hover:border-gray-600 transition-colors">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {detailUrl ? (
                      <Link href={detailUrl} className="font-semibold hover:text-accent transition-colors">
                        {t.name}
                      </Link>
                    ) : (
                      <h3 className="font-semibold">{t.name}</h3>
                    )}
                    {!isOwn && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                        Shared
                      </span>
                    )}
                    {isOwn && t.scope === 'workspace' && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                        Workspace
                      </span>
                    )}
                    {t.format && (
                      <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full border border-white/10">
                        {t.format.replace('_', ' ')}
                      </span>
                    )}
                    {t.scope === 'system' && (
                      <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                        default
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mt-2" onClick={(e) => e.stopPropagation()}>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => updateConfig(t.id, { enabled: e.target.checked })}
                        className="w-4 h-4 accent-accent"
                      />
                      Enabled
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm">
                      <input
                        type="checkbox"
                        checked={autoApprovePost}
                        onChange={(e) => updateConfig(t.id, { autoApprovePost: e.target.checked })}
                        className="w-4 h-4 accent-green-400"
                      />
                      Auto-post
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isOwn && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => toggleScope(t.id, t.scope)}
                    >
                      {t.scope === 'workspace' ? 'Make private' : 'Share'}
                    </Button>
                  )}
                  {detailUrl && (
                    <Link
                      href={detailUrl}
                      className="p-2 rounded-lg border border-gray-700 hover:border-gray-500 hover:bg-white/5 transition-colors"
                    >
                      <ChevronRight size={14} className="text-gray-400" />
                    </Link>
                  )}
                </div>
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
