'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, Wand2, CheckCircle2, Trash2 } from 'lucide-react'

import Modal from '@/modules/shared/components/Modal'

// Simple helper to load available templates to pass to compose (UI feedback)
export default function AccountIdeas({ accountId }: { accountId: string }) {
  const [ideas, setIdeas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [composingIdea, setComposingIdea] = useState<any | null>(null)
  const [composing, setComposing] = useState<boolean>(false)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Framework Management
  const [frameworks, setFrameworks] = useState<any[]>([])
  const [editingFramework, setEditingFramework] = useState<any | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [frameworkForm, setFrameworkForm] = useState({
    name: '',
    systemPrompt: '',
    isDefault: true,
  })

  // Manual Selection State
  const [personas, setPersonas] = useState<any[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('')
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string>('')

  const fetchFrameworks = async () => {
    try {
      const res = await fetch(`/api/ideas-frameworks?accountId=${accountId}`)
      const data = await res.json()
      setFrameworks(data.frameworks || [])
      const def = data.frameworks?.find((f: any) => f.isDefault)
      if (def) {
        setFrameworkForm({ name: def.name, systemPrompt: def.systemPrompt, isDefault: true })
        setEditingFramework(def)
        setSelectedFrameworkId(def.id)
      }
    } catch {
      toast.error('Failed to load frameworks')
    }
  }

  const fetchPersonas = async () => {
    try {
      const res = await fetch(`/api/personas?accountId=${accountId}`)
      const data = await res.json()
      setPersonas(data.personas || [])
      const def = data.personas?.find((p: any) => p.isDefault) || data.personas?.[0]
      if (def) setSelectedPersonaId(def.id)
    } catch {
      toast.error('Failed to load personas')
    }
  }

  const handleSaveFramework = async () => {
    try {
      const method = editingFramework ? 'PUT' : 'POST'
      const url = editingFramework
        ? `/api/ideas-frameworks/${editingFramework.id}`
        : '/api/ideas-frameworks'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, ...frameworkForm }),
      })
      if (!res.ok) throw new Error()
      toast.success(
        editingFramework ? 'Strategy framework updated' : 'New strategy framework created',
      )
      fetchFrameworks()
      setShowSettings(false)
    } catch {
      toast.error('Failed to save strategy framework')
    }
  }

  const fetchIdeas = async () => {
    try {
      const res = await fetch(`/api/ideas?accountId=${accountId}`)
      const data = await res.json()
      setIdeas(data.ideas || [])
    } catch {
      toast.error('Failed to load ideas')
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`/api/templates`)
      const data = await res.json()
      const accountTemplates = data.templates?.filter(
        (t: any) => t.accountId === accountId || !t.accountId,
      )
      setTemplates(accountTemplates || [])
    } catch {
      console.error('Failed to parse templates')
    }
  }

  useEffect(() => {
    fetchIdeas()
    fetchFrameworks()
    fetchPersonas()
    fetchTemplates()
  }, [accountId])

  const handleGenerate = async () => {
    setGenerating(true)
    const toastId = toast.loading('Consulting Brand Persona & generating 5 ideas...')
    try {
      const res = await fetch('/api/agent/idea-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          personaId: selectedPersonaId,
          frameworkId: selectedFrameworkId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('Generated new ideas!', { id: toastId })
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this idea?')) return
    try {
      await fetch(`/api/ideas/${id}`, { method: 'DELETE' })
      setIdeas(ideas.filter((i) => i.id !== id))
    } catch {
      toast.error('Failed to delete idea')
    }
  }

  const handleApprove = async (idea: any) => {
    setApproving(idea.id)
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })

      if (!res.ok) throw new Error('Failed to approve')

      toast.success('Idea approved!')
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setApproving(null)
    }
  }

  const handleCompose = async () => {
    if (!composingIdea) return

    setComposing(true)
    const toastId = toast.loading('Converting Idea into a Composition Template Layout...')
    try {
      const res = await fetch('/api/agent/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          prompt: composingIdea.ideaText,
          format: 'reel',
          ideaId: composingIdea.id,
          personaId: selectedPersonaId,
          templateId: selectedTemplateId || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Composition failed')

      toast.success('Idea structurally mapped into a Draft Composition!', { id: toastId })
      setComposingIdea(null)
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setComposing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h3 className="text-xl font-heading font-semibold">Content Backlog</h3>
          <p className="text-xs text-gray-500">
            Pick specific personas/strategies for manual brainstorming.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="bg-gray-900 border border-gray-800 rounded p-1.5 text-xs text-gray-300"
            value={selectedPersonaId}
            onChange={(e) => setSelectedPersonaId(e.target.value)}
          >
            <option value="">Default Persona</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.isDefault ? '⭐ ' : ''}
                {p.name}
              </option>
            ))}
          </select>

          <select
            className="bg-gray-900 border border-gray-800 rounded p-1.5 text-xs text-gray-300"
            value={selectedFrameworkId}
            onChange={(e) => setSelectedFrameworkId(e.target.value)}
          >
            <option value="">Default Strategy</option>
            {frameworks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.isDefault ? '⭐ ' : ''}
                {f.name}
              </option>
            ))}
          </select>

          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? 'Close Settings' : 'Framework Settings'}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="flex gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            Brainstorm Ideas
          </Button>
        </div>
      </div>

      {showSettings && (
        <Card className="p-6 bg-gray-950 border-gray-800 mb-6 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-sm font-bold text-gray-400 mb-1 uppercase tracking-tight">
                Strategist Prompt Management
              </h4>
              <p className="text-xs text-gray-500 mb-4">
                Multiple strategies can be saved. Select one from the dropdown above to use it
                during brainstorming.
              </p>
            </div>
            {editingFramework && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingFramework(null)
                  setFrameworkForm({ name: '', systemPrompt: '', isDefault: false })
                }}
                className="text-xs text-blue-400"
              >
                + Add New
              </Button>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Framework Name</label>
              <input
                className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm"
                value={frameworkForm.name}
                onChange={(e) => setFrameworkForm({ ...frameworkForm, name: e.target.value })}
                placeholder="e.g. Viral Educational Strategy"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-bold">
                Ideation Instructions (Ideas Prompt)
              </label>
              <textarea
                className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm min-h-[120px]"
                value={frameworkForm.systemPrompt}
                onChange={(e) =>
                  setFrameworkForm({ ...frameworkForm, systemPrompt: e.target.value })
                }
                placeholder="Instruct the AI how to think about new ideas..."
              />
            </div>
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={frameworkForm.isDefault}
                  onChange={(e) =>
                    setFrameworkForm({ ...frameworkForm, isDefault: e.target.checked })
                  }
                  className="rounded bg-gray-800 border-gray-700"
                />
                Set as Default Strategy
              </label>
              <Button onClick={handleSaveFramework} size="sm">
                {editingFramework ? 'Update Strategy' : 'Create Strategy'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!loading && ideas.length === 0 && (
        <div className="text-center py-10 text-text-secondary border border-dashed border-gray-800 rounded-lg">
          No ideas available. Click Brainstorm to automatically consult your Brand Persona.
        </div>
      )}

      <div className="grid gap-4">
        {ideas.map((idea) => {
          const isUsed = idea.status === 'USED'
          const isPending = idea.status === 'PENDING'
          const isApproved = idea.status === 'APPROVED'

          return (
            <Card
              key={idea.id}
              className={`p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border ${isUsed ? 'border-gray-800 opacity-50 text-gray-400 bg-gray-950' : 'border-gray-700 bg-gray-900'}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase ${isUsed ? 'bg-gray-800 text-gray-500' : isApproved ? 'bg-green-900 text-green-400' : 'bg-orange-900 text-orange-400'}`}
                  >
                    {idea.status}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{idea.ideaText}</p>
              </div>

              <div className="flex gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0 justify-end items-center">
                {isUsed && (
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mr-2">
                    Already Drafted
                  </span>
                )}

                <Button
                  variant="outline"
                  className="border-red-900 text-red-500 hover:bg-red-950"
                  onClick={() => handleDelete(idea.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                {isPending && (
                  <Button
                    disabled={approving === idea.id}
                    className="bg-green-700/80 text-white hover:bg-green-700 transition-all text-xs h-8"
                    onClick={() => handleApprove(idea)}
                  >
                    {approving === idea.id ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    )}
                    Approve
                  </Button>
                )}

                {(isApproved || isUsed) && (
                  <Button
                    className={`${isUsed ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-accent text-white hover:bg-accent/80'} transition-all text-xs h-8`}
                    onClick={() => setComposingIdea(idea)}
                  >
                    <Wand2 className="w-3 h-3 mr-1" />
                    {isUsed ? 'Redo Composition' : 'Compose'}
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {composingIdea && (
        <Modal isOpen={true} onClose={() => !composing && setComposingIdea(null)}>
          <div className="space-y-4">
            <h2 className="text-xl font-heading font-semibold mb-4">Compose Idea</h2>
            <p className="text-sm text-gray-400">
              Select a template to use, or let the Director automatically determine the best
              template.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Target Template</label>
              <select
                className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                disabled={composing}
              >
                <option value="">Auto Select (Director Mode)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" disabled={composing} onClick={() => setComposingIdea(null)}>
                Cancel
              </Button>
              <Button disabled={composing} onClick={handleCompose} className="bg-accent text-white">
                {composing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Composing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" /> Start Composition
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
