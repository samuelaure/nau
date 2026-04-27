'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import { Save, Loader2, Trash2, ChevronLeft, Globe, Lock } from 'lucide-react'

interface Template {
  id: string
  name: string
  remotionId: string
  sceneType: string | null
  scope: string
  systemPrompt: string | null
  contentSchema: any
  useBrandAssets: boolean
  _count?: { compositions: number }
}

interface Props {
  template: Template
  backUrl: string
}

export default function TemplateDetailClient({ template, backUrl }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [name, setName] = useState(template.name)
  const [remotionId, setRemotionId] = useState(template.remotionId)
  const [sceneType, setSceneType] = useState(template.sceneType ?? '')
  const [scope, setScope] = useState(template.scope)
  const [systemPrompt, setSystemPrompt] = useState(template.systemPrompt ?? '')
  const [contentSchemaRaw, setContentSchemaRaw] = useState(
    template.contentSchema ? JSON.stringify(template.contentSchema, null, 2) : '',
  )
  const [schemaError, setSchemaError] = useState('')

  const handleSave = async () => {
    let parsedSchema = undefined
    if (contentSchemaRaw.trim()) {
      try {
        parsedSchema = JSON.parse(contentSchemaRaw)
        setSchemaError('')
      } catch {
        setSchemaError('Content schema is not valid JSON')
        return
      }
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          remotionId,
          sceneType: sceneType || null,
          scope,
          systemPrompt: systemPrompt || null,
          contentSchema: parsedSchema ?? null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Template saved')
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Template deleted')
      router.push(backUrl)
    } catch {
      toast.error('Failed to delete template')
      setDeleting(false)
    }
  }

  const handleToggleScope = async () => {
    const newScope = scope === 'workspace' ? 'brand' : 'workspace'
    setScope(newScope)
  }

  const field = (label: string, children: React.ReactNode, hint?: string) => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-text-secondary mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-600 mt-1">{hint}</p>}
    </div>
  )

  const inputClass =
    'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent'

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Back */}
      <button
        onClick={() => router.push(backUrl)}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-white transition-colors w-fit"
      >
        <ChevronLeft size={16} /> Back to Templates
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold">{template.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
            <span>{template._count?.compositions ?? 0} compositions generated</span>
            <span className="flex items-center gap-1">
              {scope === 'workspace' ? (
                <><Globe size={10} /> Workspace-shared</>
              ) : (
                <><Lock size={10} /> Brand-only</>
              )}
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={deleting || saving}
            className="border-gray-700 px-3"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-red-500" />}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || deleting}
            className="bg-accent hover:bg-accent/80 gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </Button>
        </div>
      </div>

      {/* Settings card */}
      <Card className="p-5 border-gray-800 flex flex-col gap-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-secondary">
          Settings
        </h2>

        {field('Name', <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />)}

        {field(
          'Remotion ID',
          <input value={remotionId} onChange={(e) => setRemotionId(e.target.value)} className={inputClass} />,
          'Matches the Remotion composition identifier used by the render service.',
        )}

        {field(
          'Format (scene type)',
          <select
            value={sceneType}
            onChange={(e) => setSceneType(e.target.value)}
            className={inputClass}
          >
            <option value="">— unset —</option>
            <option value="reel">Reel</option>
            <option value="trial_reel">Trial Reel</option>
            <option value="carousel">Carousel</option>
            <option value="static_post">Static Post</option>
            <option value="story">Story</option>
            <option value="head_talk">Head Talk</option>
          </select>,
          'Used by the template selector to match ideas to this template by format.',
        )}

        {field(
          'Scope',
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleScope}
              className={`relative w-10 h-5 rounded-full transition-colors ${scope === 'workspace' ? 'bg-accent' : 'bg-gray-700'}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${scope === 'workspace' ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
            <span className="text-sm text-gray-300">
              {scope === 'workspace' ? 'Shared with all brands in this workspace' : 'Only this brand'}
            </span>
          </div>,
        )}
      </Card>

      {/* Narrative guidance */}
      <Card className="p-5 border-gray-800 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-text-secondary">
            Narrative Guidance
          </h2>
          <p className="text-[11px] text-gray-600 mt-1">
            Injected into the AI Creative Director as "Template Narrative Guidance". Shapes how scenes are structured and written.
          </p>
        </div>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
          className={`${inputClass} resize-none`}
          placeholder="Describe the narrative structure and tone this template should follow…"
        />
      </Card>

      {/* Content schema */}
      <Card className="p-5 border-gray-800 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-text-secondary">
            Content Schema
          </h2>
          <p className="text-[11px] text-gray-600 mt-1">
            JSON object injected as "Template Content Schema — slot specs per scene". Tells the AI exactly what to write in each slot.
          </p>
        </div>
        <textarea
          value={contentSchemaRaw}
          onChange={(e) => { setContentSchemaRaw(e.target.value); setSchemaError('') }}
          rows={14}
          className={`${inputClass} resize-none font-mono text-xs`}
          placeholder='{ "format": "reel", "structure": [...] }'
          spellCheck={false}
        />
        {schemaError && (
          <p className="text-xs text-red-400">{schemaError}</p>
        )}
      </Card>

      <div className="flex justify-end pb-8">
        <Button
          onClick={handleSave}
          disabled={saving || deleting}
          className="bg-accent hover:bg-accent/80 gap-1.5"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save template
        </Button>
      </div>
    </div>
  )
}
