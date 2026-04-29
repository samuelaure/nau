'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronRight, SlidersHorizontal, ChevronDown, Loader2 } from 'lucide-react'
import { installDefaultTemplates } from '@/modules/accounts/actions'
import { cn } from '@/modules/shared/utils'

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
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null)
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({})
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null)

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

  const handlePromptToggle = (templateId: string, currentPrompt: string | null | undefined) => {
    if (expandedPrompt === templateId) {
      setExpandedPrompt(null)
    } else {
      setPromptDrafts(prev => ({ ...prev, [templateId]: currentPrompt ?? '' }))
      setExpandedPrompt(templateId)
    }
  }

  const handleSavePrompt = async (templateId: string) => {
    setSavingPrompt(templateId)
    try {
      const res = await fetch('/api/account-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, templateId, customPrompt: promptDrafts[templateId] || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Prompt saved')
      fetchTemplates()
    } catch {
      toast.error('Failed to save prompt')
    } finally {
      setSavingPrompt(null)
    }
  }

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

          const customPrompt = config?.customPrompt ?? null
          const isPromptExpanded = expandedPrompt === t.id

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
                    <button
                      onClick={() => handlePromptToggle(t.id, customPrompt)}
                      className={cn(
                        'flex items-center gap-1.5 text-xs transition-colors',
                        customPrompt ? 'text-amber-300 hover:text-amber-200' : 'text-text-secondary hover:text-white',
                      )}
                    >
                      <SlidersHorizontal size={11} />
                      {customPrompt ? 'Prompt set' : 'Set prompt'}
                      <ChevronDown size={11} className={cn('transition-transform', isPromptExpanded && 'rotate-180')} />
                    </button>
                  </div>

                  {isPromptExpanded && (
                    <div className="mt-3 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs text-text-secondary">
                        Custom instructions injected when this template is used for drafting — takes priority over all defaults.
                      </p>
                      <textarea
                        rows={4}
                        value={promptDrafts[t.id] ?? ''}
                        onChange={e => setPromptDrafts(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder={`e.g. 'Always open with a provocative question. Keep each scene text under 8 words.'`}
                        className="w-full bg-gray-950 border border-gray-800 rounded p-2.5 text-xs text-white resize-none focus:outline-none focus:border-accent/50"
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setExpandedPrompt(null)}>Cancel</Button>
                        <Button
                          size="sm"
                          className="text-xs bg-accent text-white"
                          disabled={savingPrompt === t.id}
                          onClick={() => handleSavePrompt(t.id)}
                        >
                          {savingPrompt === t.id ? <Loader2 size={11} className="animate-spin mr-1" /> : null}
                          Save Prompt
                        </Button>
                      </div>
                    </div>
                  )}
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
