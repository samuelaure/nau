'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, Wand2, CheckCircle2, Trash2, Zap, User, Bot, Pencil } from 'lucide-react'

import Modal from '@/modules/shared/components/Modal'

// Source badge config
const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> =
  {
    captured: {
      label: 'Captured',
      icon: Zap,
      className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    },
    manual: {
      label: 'Manual',
      icon: User,
      className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    },
    automatic: {
      label: 'Auto',
      icon: Bot,
      className: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    },
  }

function SourceBadge({ source }: { source: string }) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.automatic
  const Icon = config.icon
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase ${config.className}`}
    >
      <Icon size={10} />
      {config.label}
    </span>
  )
}

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

  // Persona & Framework selection
  const [personas, setPersonas] = useState<any[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('')
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string>('')

  // Brainstorm modal
  const [brainstormModalOpen, setBrainstormModalOpen] = useState(false)
  const [brainstormConcept, setBrainstormConcept] = useState('')
  const [brainstormCount, setBrainstormCount] = useState<number | ''>('')

  // Manual idea modal
  const [manualIdeaModalOpen, setManualIdeaModalOpen] = useState(false)
  const [manualIdeaText, setManualIdeaText] = useState('')

  // Edit idea modal
  const [editingIdea, setEditingIdea] = useState<any | null>(null)
  const [editIdeaText, setEditIdeaText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Bulk actions
  const [bulkApproving, setBulkApproving] = useState(false)
  const [bulkClearing, setBulkClearing] = useState(false)

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
      const sorted = (data.ideas || []).sort((a: any, b: any) => {
        if (a.priority !== b.priority) return (a.priority ?? 3) - (b.priority ?? 3)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      setIdeas(sorted)
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

  const handleGenerate = async (concept?: string, countOverride?: number) => {
    setGenerating(true)
    const toastId = toast.loading(
      concept
        ? `Generating ideas from concept: "${concept.slice(0, 40)}..."`
        : 'Consulting Brand Persona & generating ideas...',
    )
    try {
      const res = await fetch('/api/agent/idea-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          personaId: selectedPersonaId,
          frameworkId: selectedFrameworkId,
          concept: brainstormSource === 'manual' ? concept || undefined : undefined,
          count: countOverride || undefined,
          source: brainstormSource,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(`Generated ${data.ideas?.length ?? 0} new ideas!`, { id: toastId })
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setGenerating(false)
      setBrainstormModalOpen(false)
      setBrainstormConcept('')
      setBrainstormCount('')
    }
  }

  const handleCreateManualIdea = async () => {
    if (!manualIdeaText.trim()) return
    const toastId = toast.loading('Creating manual concept idea...')
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          ideaText: manualIdeaText,
          source: 'manual',
          priority: 2,
          status: 'PENDING',
        }),
      })
      if (!res.ok) throw new Error('Failed to create manual idea')
      toast.success('Idea created!', { id: toastId })
      setManualIdeaText('')
      setManualIdeaModalOpen(false)
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
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

  const handleApproveAll = async () => {
    const pending = ideas.filter((i) => i.status === 'PENDING')
    if (pending.length === 0) return toast.info('No pending ideas to approve')
    setBulkApproving(true)
    const toastId = toast.loading(`Approving ${pending.length} ideas...`)
    try {
      await Promise.all(
        pending.map((idea) =>
          fetch(`/api/ideas/${idea.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'APPROVED' }),
          }),
        ),
      )
      toast.success(`Approved ${pending.length} ideas`, { id: toastId })
      fetchIdeas()
    } catch {
      toast.error('Some approvals failed', { id: toastId })
    } finally {
      setBulkApproving(false)
    }
  }

  const handleClearUsed = async () => {
    const used = ideas.filter((i) => i.status === 'USED')
    if (used.length === 0) return toast.info('No used ideas to clear')
    if (!confirm(`Delete ${used.length} used ideas?`)) return
    setBulkClearing(true)
    const toastId = toast.loading(`Clearing ${used.length} used ideas...`)
    try {
      await Promise.all(used.map((idea) => fetch(`/api/ideas/${idea.id}`, { method: 'DELETE' })))
      toast.success(`Cleared ${used.length} used ideas`, { id: toastId })
      fetchIdeas()
    } catch {
      toast.error('Some deletions failed', { id: toastId })
    } finally {
      setBulkClearing(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingIdea || !editIdeaText.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/ideas/${editingIdea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaText: editIdeaText }),
      })
      if (!res.ok) throw new Error('Failed to save edit')
      toast.success('Idea updated')
      setEditingIdea(null)
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingEdit(false)
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

  const pendingCount = ideas.filter((i) => i.status === 'PENDING').length
  const usedCount = ideas.filter((i) => i.status === 'USED').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h3 className="text-xl font-heading font-semibold">Content Backlog</h3>
          <p className="text-xs text-gray-500">
            Captured ideas first, then manual, then automatic. Pick a persona/strategy to
            brainstorm.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="bg-gray-900 border border-gray-800 rounded p-1.5 text-xs text-gray-300 w-[120px]"
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
            className="bg-gray-900 border border-gray-800 rounded p-1.5 text-xs text-gray-300 w-[120px]"
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
            Settings
          </Button>

          {usedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={bulkClearing}
              onClick={handleClearUsed}
              className="text-gray-500 border-gray-700 hover:border-red-800 hover:text-red-400"
            >
              {bulkClearing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                `Clear Used (${usedCount})`
              )}
            </Button>
          )}

          {pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={bulkApproving}
              onClick={handleApproveAll}
              className="text-green-500 border-green-900 hover:bg-green-950"
            >
              {bulkApproving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                `Approve All (${pendingCount})`
              )}
            </Button>
          )}

          <Button
            onClick={() => setManualIdeaModalOpen(true)}
            size="sm"
            className="flex gap-2 bg-gray-800 text-white hover:bg-gray-700"
          >
            + Manual
          </Button>

          <Button
            onClick={() => setBrainstormModalOpen(true)}
            disabled={generating}
            size="sm"
            className="flex gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            Brainstorm
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
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase ${isUsed ? 'bg-gray-800 text-gray-500' : isApproved ? 'bg-green-900 text-green-400' : 'bg-orange-900 text-orange-400'}`}
                  >
                    {idea.status}
                  </span>
                  {idea.source && <SourceBadge source={idea.source} />}
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
                  className="border-gray-700 text-gray-400 hover:text-white"
                  onClick={() => {
                    setEditingIdea(idea)
                    setEditIdeaText(idea.ideaText)
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>

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

      {/* Brainstorm Modal — supports optional concept for targeted generation or InspoBase flow */}
      {brainstormModalOpen && (
        <Modal isOpen={true} onClose={() => !generating && setBrainstormModalOpen(false)}>
          <div className="space-y-4">
            <h2 className="text-xl font-heading font-semibold mb-1">Brainstorm Ideas</h2>

            <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800 mb-4">
              <button
                onClick={() => setBrainstormSource('manual')}
                className={cn(
                  'flex-1 py-1.5 text-xs font-bold rounded-md transition-all',
                  brainstormSource === 'manual'
                    ? 'bg-gray-800 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300',
                )}
              >
                Manual Concept
              </button>
              <button
                onClick={() => setBrainstormSource('automatic')}
                className={cn(
                  'flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2',
                  brainstormSource === 'automatic'
                    ? 'bg-gray-800 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300',
                )}
              >
                <Bot size={12} />
                InspoBase
              </button>
            </div>

            {brainstormSource === 'manual' ? (
              <div className="space-y-1">
                <label className="text-xs text-gray-400">
                  Concept Prompt <span className="text-gray-600 font-normal">(optional)</span>
                </label>
                <textarea
                  autoFocus
                  className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm min-h-[100px]"
                  value={brainstormConcept}
                  onChange={(e) => setBrainstormConcept(e.target.value)}
                  placeholder="e.g. 'How AI is changing content creation' or a trending topic..."
                  disabled={generating}
                />
              </div>
            ) : (
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-4">
                <p className="text-xs text-purple-200/70 leading-relaxed">
                  The AI will consume the latest <strong>Mechanical Digest</strong> from
                  Nauthenticity's InspoBase. It will combine the Global synthesis with recent
                  inspirations to generate non-repetitive ideas.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Number of ideas to spawn{' '}
                <span className="text-gray-600 font-normal">
                  (leave blank to use persona default)
                </span>
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={brainstormCount}
                onChange={(e) =>
                  setBrainstormCount(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="e.g. 5"
                disabled={generating}
                className="w-24 bg-gray-900 border border-gray-800 text-white rounded p-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                disabled={generating}
                onClick={() => setBrainstormModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={generating}
                onClick={() =>
                  handleGenerate(
                    brainstormConcept.trim() || undefined,
                    brainstormCount !== '' ? brainstormCount : undefined,
                  )
                }
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" /> Generate Ideas
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Compose Modal */}
      {composingIdea && (
        <Modal isOpen={true} onClose={() => !composing && setComposingIdea(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-heading font-semibold">Compose Reel</h2>
              {composingIdea.source && <SourceBadge source={composingIdea.source} />}
            </div>

            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 max-h-[120px] overflow-y-auto">
              <p className="text-xs text-gray-400 whitespace-pre-wrap">{composingIdea.ideaText}</p>
            </div>

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

      {/* Manual Idea Modal */}
      {manualIdeaModalOpen && (
        <Modal isOpen={true} onClose={() => setManualIdeaModalOpen(false)}>
          <div className="space-y-4">
            <h2 className="text-xl font-heading font-semibold mb-4">Manual Concept Idea</h2>
            <p className="text-sm text-gray-400">
              Record a specific concept idea you have in mind. It will be added as{' '}
              <span className="text-orange-400">PENDING</span> for review.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Concept Description</label>
              <textarea
                autoFocus
                className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm min-h-[120px]"
                value={manualIdeaText}
                onChange={(e) => setManualIdeaText(e.target.value)}
                placeholder="Write the concept format, the hook, the educational value..."
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setManualIdeaModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateManualIdea}
                className="bg-accent text-white"
                disabled={!manualIdeaText.trim()}
              >
                Save Idea
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Idea Modal */}
      {editingIdea && (
        <Modal isOpen={true} onClose={() => !savingEdit && setEditingIdea(null)}>
          <div className="space-y-4">
            <h2 className="text-xl font-heading font-semibold mb-1">Edit Idea</h2>
            <p className="text-sm text-gray-400">
              Refine the AI-generated or captured idea text before approving or composing.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Idea Text</label>
              <textarea
                autoFocus
                className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm min-h-[200px]"
                value={editIdeaText}
                onChange={(e) => setEditIdeaText(e.target.value)}
                disabled={savingEdit}
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" disabled={savingEdit} onClick={() => setEditingIdea(null)}>
                Cancel
              </Button>
              <Button
                disabled={savingEdit || !editIdeaText.trim()}
                onClick={handleSaveEdit}
                className="bg-accent text-white"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
