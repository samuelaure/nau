'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import HeadTalkDraftModal from './HeadTalkDraftModal'
import {
  Loader2,
  Wand2,
  CheckCircle2,
  Trash2,
  Zap,
  User,
  Bot,
  Brain,
  Film,
  ImageIcon,
  LayoutGrid,
  Mic,
  Play,
  Square,
  CheckSquare,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react'
import Modal from '@/modules/shared/components/Modal'
import { cn } from '@/modules/shared/utils'

// ── Badge configs ─────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  captured: { label: 'Captured', icon: Zap, className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  manual: { label: 'Manual', icon: User, className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  automatic: { label: 'Auto', icon: Bot, className: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
}

const FORMAT_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  reel: { label: 'Reel', icon: Film, className: 'bg-pink-500/10 text-pink-400 border border-pink-500/20' },
  trial_reel: { label: 'Trial Reel', icon: Play, className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
  head_talk: { label: 'Head Talk', icon: Mic, className: 'bg-teal-500/10 text-teal-400 border border-teal-500/20' },
  carousel: { label: 'Carousel', icon: LayoutGrid, className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  static_post: { label: 'Static Post', icon: ImageIcon, className: 'bg-gray-500/10 text-gray-400 border border-gray-500/20' },
  story: { label: 'Story', icon: Play, className: 'bg-violet-500/10 text-violet-400 border border-violet-500/20' },
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  IDEA_PENDING: { label: 'Pending', className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
  IDEA_APPROVED: { label: 'Approved', className: 'bg-green-500/10 text-green-400 border border-green-500/20' },
  USED: { label: 'Used', className: 'bg-gray-500/10 text-gray-500 border border-gray-700' },
}

function Badge({ label, icon: Icon, className }: { label: string; icon?: React.ElementType; className: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase', className)}>
      {Icon && <Icon size={10} />}
      {label}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BrandPosts({ brandId }: { brandId: string }) {
  const [ideas, setIdeas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [composingIdea, setComposingIdea] = useState<any | null>(null)
  const [composing, setComposing] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [headTalkDraftPost, setHeadTalkDraftPost] = useState<any | null>(null)
  const [personas, setPersonas] = useState<any[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState('')

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkApproving, setBulkApproving] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Brainstorm modal
  const [brainstormOpen, setBrainstormOpen] = useState(false)
  const [brainstormConcept, setBrainstormConcept] = useState('')
  const [brainstormCount, setBrainstormCount] = useState<number | ''>('')
  const [brainstormSource, setBrainstormSource] = useState<'manual' | 'automatic'>('manual')

  // Manual idea modal
  const [manualOpen, setManualOpen] = useState(false)
  const [manualText, setManualText] = useState('')

  // Ideation prompt
  const [ideationPrompt, setIdeationPrompt] = useState('')
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [promptDraft, setPromptDraft] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [brainstormShowPrompt, setBrainstormShowPrompt] = useState(false)
  const [manualShowPrompt, setManualShowPrompt] = useState(false)

  // Idea detail modal
  const [openIdea, setOpenIdea] = useState<any | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingIdea, setDeletingIdea] = useState(false)

  const fetchIdeationPrompt = async () => {
    try {
      const res = await fetch(`/api/brands/${brandId}`)
      const data = await res.json()
      setIdeationPrompt(data.brand?.ideationPrompt ?? '')
    } catch {}
  }

  const handleSavePrompt = async (text: string) => {
    setSavingPrompt(true)
    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideationPrompt: text || null }),
      })
      if (!res.ok) throw new Error()
      setIdeationPrompt(text)
      toast.success('Ideation prompt saved')
    } catch {
      toast.error('Failed to save prompt')
    } finally {
      setSavingPrompt(false)
    }
  }

  const fetchIdeas = async () => {
    try {
      const res = await fetch(`/api/ideas?brandId=${brandId}`)
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

  useEffect(() => {
    fetchIdeas()
    fetchIdeationPrompt()
    fetch(`/api/personas?brandId=${brandId}`).then(r => r.json()).then(d => {
      setPersonas(d.personas || [])
      const def = d.personas?.find((p: any) => p.isDefault) || d.personas?.[0]
      if (def) setSelectedPersonaId(def.id)
    }).catch(() => {})
    fetch('/api/templates').then(r => r.json()).then(d => {
      setTemplates((d.templates || []).filter((t: any) => t.brandId === brandId || !t.brandId))
    }).catch(() => {})
  }, [brandId])

  // ── Selection helpers ───────────────────────────────────────────────────────

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  const selectAll = () => setSelected(new Set(ideas.map(i => i.id)))

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setDeletingIdea(true)
    try {
      await fetch(`/api/ideas/${id}`, { method: 'DELETE' })
      setIdeas(prev => prev.filter(i => i.id !== id))
      setOpenIdea(null)
    } catch {
      toast.error('Failed to delete idea')
    } finally {
      setDeletingIdea(false)
    }
  }

  const handleApprove = async (idea: any) => {
    setApproving(idea.id)
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IDEA_APPROVED' }),
      })
      if (!res.ok) throw new Error('Failed to approve')
      toast.success('Idea approved!')
      await fetchIdeas()
      setOpenIdea((prev: any) => prev?.id === idea.id ? { ...prev, status: 'IDEA_APPROVED' } : prev)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setApproving(null)
    }
  }

  const handleBulkApprove = async () => {
    const ids = [...selected].filter(id => ideas.find(i => i.id === id)?.status === 'IDEA_PENDING')
    if (!ids.length) return toast.info('No pending ideas in selection')
    setBulkApproving(true)
    const toastId = toast.loading(`Approving ${ids.length} ideas…`)
    try {
      await Promise.all(ids.map(id => fetch(`/api/ideas/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IDEA_APPROVED' }),
      })))
      toast.success(`Approved ${ids.length} ideas`, { id: toastId })
      clearSelection()
      fetchIdeas()
    } catch {
      toast.error('Some approvals failed', { id: toastId })
    } finally {
      setBulkApproving(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} selected ideas?`)) return
    setBulkDeleting(true)
    const toastId = toast.loading(`Deleting ${selected.size} ideas…`)
    try {
      await Promise.all([...selected].map(id => fetch(`/api/ideas/${id}`, { method: 'DELETE' })))
      toast.success(`Deleted ${selected.size} ideas`, { id: toastId })
      clearSelection()
      fetchIdeas()
    } catch {
      toast.error('Some deletions failed', { id: toastId })
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!openIdea || !editText.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/ideas/${openIdea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaText: editText }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Idea updated')
      setOpenIdea((prev: any) => prev ? { ...prev, ideaText: editText } : prev)
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleCreateManualIdea = async () => {
    if (!manualText.trim()) return
    const toastId = toast.loading('Creating idea…')
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, ideaText: manualText, source: 'manual', priority: 2, status: 'IDEA_PENDING' }),
      })
      if (!res.ok) throw new Error('Failed to create idea')
      toast.success('Idea created!', { id: toastId })
      setManualText('')
      setManualOpen(false)
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  const handleGenerate = async () => {
    if (brainstormSource === 'manual' && !brainstormConcept.trim()) {
      toast.error('Please enter a topic.')
      return
    }
    setGenerating(true)
    const toastId = toast.loading(brainstormSource === 'automatic' ? 'Fetching InspoBase digest…' : `Generating ideas about: "${brainstormConcept.slice(0, 40)}…"`)
    try {
      const res = await fetch('/api/agent/idea-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, topic: brainstormSource === 'manual' ? brainstormConcept : undefined, count: brainstormCount || undefined, source: brainstormSource }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(`Generated ${data.ideas?.length ?? 0} new ideas!`, { id: toastId })
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setGenerating(false)
      setBrainstormOpen(false)
      setBrainstormConcept('')
      setBrainstormCount('')
    }
  }

  const handleCompose = async () => {
    if (!composingIdea) return
    setComposing(true)
    const toastId = toast.loading('Converting idea into draft…')
    try {
      const finalFormat = selectedTemplateId
        ? templates.find(t => t.id === selectedTemplateId)?.format || composingIdea.format || 'head_talk'
        : composingIdea.format || 'head_talk'
      const res = await fetch('/api/agent/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, prompt: composingIdea.ideaText, format: finalFormat, postId: composingIdea.id, personaId: selectedPersonaId || undefined, templateId: selectedTemplateId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Composition failed')
      toast.success('Draft generated!', { id: toastId })
      setComposingIdea(null)
      setOpenIdea(null)
      fetchIdeas()
      if (finalFormat === 'head_talk' && data.post) setHeadTalkDraftPost(data.post)
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setComposing(false)
    }
  }

  const pendingCount = ideas.filter(i => i.status === 'IDEA_PENDING').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-heading font-semibold">Content Backlog</h3>
          <p className="text-xs text-text-secondary">Captured ideas first, then manual, then automatic.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => { setPromptDraft(ideationPrompt); setPromptModalOpen(true) }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              ideationPrompt
                ? 'text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20'
                : 'text-text-secondary border-white/10 hover:text-white hover:bg-white/5',
            )}
          >
            <SlidersHorizontal size={12} />
            {ideationPrompt ? 'Prompt set' : 'Set prompt'}
          </button>
          <Button onClick={() => setManualOpen(true)} size="sm" variant="outline">
            + Add Idea
          </Button>
          <Button
            onClick={() => setBrainstormOpen(true)}
            disabled={generating}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Brainstorm
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-accent/10 border border-accent/20 text-sm">
          <span className="text-accent font-medium">{selected.size} selected</span>
          <button onClick={selectAll} className="text-text-secondary hover:text-white text-xs transition-colors">Select all</button>
          <button onClick={clearSelection} className="text-text-secondary hover:text-white text-xs transition-colors">Clear</button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            disabled={bulkApproving}
            onClick={handleBulkApprove}
            className="text-green-400 border-green-900 hover:bg-green-950 text-xs"
          >
            {bulkApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkDeleting}
            onClick={handleBulkDelete}
            className="text-red-400 border-red-900 hover:bg-red-950 text-xs"
          >
            {bulkDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Delete
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && ideas.length === 0 && (
        <div className="text-center py-16 text-text-secondary border border-dashed border-white/10 rounded-lg">
          <Brain size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">No ideas yet. Hit <strong>Brainstorm</strong> to generate some.</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {ideas.map((idea) => {
          const isUsed = idea.status === 'USED'
          const isPending = idea.status === 'IDEA_PENDING'
          const isSelected = selected.has(idea.id)
          const statusCfg = STATUS_CONFIG[idea.status]
          const sourceCfg = SOURCE_CONFIG[idea.source] ?? SOURCE_CONFIG.automatic

          return (
            <Card
              key={idea.id}
              onClick={() => { setOpenIdea(idea); setEditText(idea.ideaText) }}
              className={cn(
                'relative p-4 flex flex-col gap-3 cursor-pointer transition-all select-none',
                isSelected
                  ? 'border-accent/50 bg-accent/5'
                  : isUsed
                    ? 'opacity-50 border-white/5'
                    : 'hover:border-white/20',
              )}
            >
              {/* Select checkbox */}
              <button
                onClick={(e) => toggleSelect(idea.id, e)}
                className="absolute top-3 right-3 text-text-secondary hover:text-white transition-colors"
              >
                {isSelected ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} className="opacity-30 hover:opacity-100" />}
              </button>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pr-6">
                {statusCfg && <Badge label={statusCfg.label} className={statusCfg.className} />}
                <Badge label={sourceCfg.label} icon={sourceCfg.icon} className={sourceCfg.className} />
                {idea.format && (() => {
                  const fc = FORMAT_CONFIG[idea.format]
                  return fc ? <Badge label={fc.label} icon={fc.icon} className={fc.className} /> : null
                })()}
                {idea.aiLinked && <Badge label="AI-Linked" icon={Brain} className="bg-rose-500/10 text-rose-400 border border-rose-500/20" />}
              </div>

              {/* Idea text */}
              <p className="text-sm text-white/90 leading-relaxed line-clamp-4">{idea.ideaText}</p>

              {/* Footer */}
              <div className="flex items-center justify-between mt-auto pt-1">
                <span className="text-[10px] text-text-secondary">
                  {new Date(idea.createdAt).toLocaleDateString('en-GB')}
                </span>
                {isPending && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleApprove(idea) }}
                    disabled={approving === idea.id}
                    className="flex items-center gap-1 text-[11px] font-semibold text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                  >
                    {approving === idea.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                    Approve
                  </button>
                )}
                {(idea.status === 'IDEA_APPROVED' || isUsed) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setComposingIdea(idea) }}
                    className={cn(
                      'flex items-center gap-1 text-[11px] font-semibold transition-colors',
                      isUsed ? 'text-text-secondary hover:text-white' : 'text-accent hover:text-accent/80',
                    )}
                  >
                    <Wand2 size={11} />
                    {isUsed ? 'Redo Draft' : 'Draft'}
                  </button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* ── Idea detail modal ─────────────────────────────────────────────────── */}
      {openIdea && (
        <Modal isOpen={true} onClose={() => !savingEdit && !deletingIdea && setOpenIdea(null)}>
          <div className="flex flex-col gap-5">
            {/* Title + tags */}
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-heading font-semibold">Idea</h2>
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const s = STATUS_CONFIG[openIdea.status]
                  return s ? <Badge label={s.label} className={s.className} /> : null
                })()}
                {(() => {
                  const sc = SOURCE_CONFIG[openIdea.source] ?? SOURCE_CONFIG.automatic
                  return <Badge label={sc.label} icon={sc.icon} className={sc.className} />
                })()}
                {openIdea.format && (() => {
                  const fc = FORMAT_CONFIG[openIdea.format]
                  return fc ? <Badge label={fc.label} icon={fc.icon} className={fc.className} /> : null
                })()}
                {openIdea.aiLinked && <Badge label="AI-Linked" icon={Brain} className="bg-rose-500/10 text-rose-400 border border-rose-500/20" />}
              </div>
            </div>

            {/* Editable text */}
            <textarea
              className="w-full bg-gray-950 border border-border text-white rounded-lg p-3 text-sm min-h-[180px] resize-y focus:outline-none focus:border-accent/50"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              disabled={savingEdit || deletingIdea}
            />

            {/* Delete / Cancel / Save */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={deletingIdea || savingEdit}
                onClick={() => handleDelete(openIdea.id)}
                className="text-red-400 border-red-900 hover:bg-red-950"
              >
                {deletingIdea ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                disabled={savingEdit || deletingIdea}
                onClick={() => setOpenIdea(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={savingEdit || deletingIdea || !editText.trim() || editText === openIdea.ideaText}
                onClick={handleSaveEdit}
                className="bg-accent text-white hover:bg-accent/80"
              >
                {savingEdit ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving…</> : 'Save Changes'}
              </Button>
            </div>

            {/* Action button */}
            {openIdea.status === 'IDEA_PENDING' && (
              <div className="pt-2 border-t border-white/5">
                <Button
                  disabled={approving === openIdea.id}
                  onClick={() => handleApprove(openIdea)}
                  className="w-full bg-green-700/80 hover:bg-green-700 text-white"
                >
                  {approving === openIdea.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Approve
                </Button>
              </div>
            )}
            {(openIdea.status === 'IDEA_APPROVED' || openIdea.status === 'USED') && (
              <div className="pt-2 border-t border-white/5">
                <Button
                  onClick={() => { setComposingIdea(openIdea); setOpenIdea(null) }}
                  className={cn('w-full text-white', openIdea.status === 'USED' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-accent hover:bg-accent/80')}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  {openIdea.status === 'USED' ? 'Redo Draft' : 'Draft'}
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Brainstorm modal ──────────────────────────────────────────────────── */}
      {brainstormOpen && (
        <Modal isOpen={true} onClose={() => !generating && setBrainstormOpen(false)}>
          <div className="space-y-4">
            <h2 className="text-xl font-heading font-semibold">Brainstorm Ideas</h2>
            <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
              {(['manual', 'automatic'] as const).map(src => (
                <button
                  key={src}
                  onClick={() => setBrainstormSource(src)}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5',
                    brainstormSource === src ? 'bg-gray-800 text-white' : 'text-text-secondary hover:text-white',
                  )}
                >
                  {src === 'automatic' && <Bot size={12} />}
                  {src === 'manual' ? 'Manual Concept' : 'InspoBase'}
                </button>
              ))}
            </div>
            {brainstormSource === 'manual' ? (
              <textarea
                autoFocus
                className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm min-h-[100px]"
                value={brainstormConcept}
                onChange={e => setBrainstormConcept(e.target.value)}
                placeholder="e.g. 'How AI is changing content creation'…"
                disabled={generating}
              />
            ) : (
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-4">
                <p className="text-xs text-purple-200/70 leading-relaxed">
                  The AI will consume the latest <strong>Mechanical Digest</strong> from Nauthenticity&apos;s InspoBase and generate non-repetitive ideas.
                </p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <label className="text-xs text-text-secondary whitespace-nowrap">Count (leave blank for default)</label>
              <input
                type="number" min={1} max={20}
                value={brainstormCount}
                onChange={e => setBrainstormCount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 5"
                disabled={generating}
                className="w-20 bg-gray-900 border border-gray-800 text-white rounded p-2 text-sm"
              />
            </div>
            <div>
              <button
                onClick={() => setBrainstormShowPrompt(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  ideationPrompt ? 'text-amber-300 hover:text-amber-200' : 'text-text-secondary hover:text-white',
                )}
              >
                <SlidersHorizontal size={11} />
                {ideationPrompt ? 'Ideation prompt set' : 'Add ideation prompt'}
                <ChevronDown size={11} className={cn('transition-transform', brainstormShowPrompt && 'rotate-180')} />
              </button>
              {brainstormShowPrompt && (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    rows={3}
                    value={ideationPrompt}
                    onChange={e => setIdeationPrompt(e.target.value)}
                    placeholder="e.g. 'Always focus on founder-led content with a contrarian angle. Avoid corporate tone.'"
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs text-white resize-none"
                  />
                  <Button size="sm" variant="outline" disabled={savingPrompt} onClick={() => handleSavePrompt(ideationPrompt)} className="self-end text-xs">
                    {savingPrompt ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" disabled={generating} onClick={() => setBrainstormOpen(false)}>Cancel</Button>
              <Button disabled={generating} onClick={handleGenerate} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating…</> : <><Wand2 className="w-4 h-4 mr-2" />Generate Ideas</>}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Compose modal ─────────────────────────────────────────────────────── */}
      {composingIdea && (
        <Modal isOpen={true} onClose={() => !composing && setComposingIdea(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-heading font-semibold">Draft</h2>
              {composingIdea.source && (() => { const sc = SOURCE_CONFIG[composingIdea.source]; return sc ? <Badge label={sc.label} icon={sc.icon} className={sc.className} /> : null })()}
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 max-h-[120px] overflow-y-auto">
              <p className="text-xs text-gray-400 whitespace-pre-wrap">{composingIdea.ideaText}</p>
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Target Template</label>
              <select
                className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm"
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                disabled={composing}
              >
                <option value="">Auto Select (Director Mode)</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" disabled={composing} onClick={() => setComposingIdea(null)}>Cancel</Button>
              <Button disabled={composing} onClick={handleCompose} className="bg-accent text-white">
                {composing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Composing…</> : <><Wand2 className="w-4 h-4 mr-2" />Generate Draft</>}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Manual idea modal ─────────────────────────────────────────────────── */}
      {manualOpen && (
        <Modal isOpen={true} onClose={() => setManualOpen(false)}>
          <div className="space-y-4">
            <h2 className="text-xl font-heading font-semibold">Add Idea</h2>
            <textarea
              autoFocus
              className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm min-h-[120px]"
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder="Write the concept — hook, angle, educational value…"
            />
            <div>
              <button
                onClick={() => setManualShowPrompt(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  ideationPrompt ? 'text-amber-300 hover:text-amber-200' : 'text-text-secondary hover:text-white',
                )}
              >
                <SlidersHorizontal size={11} />
                {ideationPrompt ? 'Ideation prompt set' : 'Add ideation prompt'}
                <ChevronDown size={11} className={cn('transition-transform', manualShowPrompt && 'rotate-180')} />
              </button>
              {manualShowPrompt && (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    rows={3}
                    value={ideationPrompt}
                    onChange={e => setIdeationPrompt(e.target.value)}
                    placeholder="e.g. 'Always focus on founder-led content with a contrarian angle.'"
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs text-white resize-none"
                  />
                  <Button size="sm" variant="outline" disabled={savingPrompt} onClick={() => handleSavePrompt(ideationPrompt)} className="self-end text-xs">
                    {savingPrompt ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateManualIdea} className="bg-accent text-white" disabled={!manualText.trim()}>
                Save Idea
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Ideation prompt modal ────────────────────────────────────────────── */}
      {promptModalOpen && (
        <Modal isOpen={true} onClose={() => !savingPrompt && setPromptModalOpen(false)}>
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-heading font-semibold">Ideation Prompt</h2>
              <p className="text-xs text-text-secondary mt-1">
                Custom instructions injected into every idea generation — manual, brainstorm, and automatic. They take priority over all default guidelines.
              </p>
            </div>
            <textarea
              autoFocus
              rows={8}
              className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-sm text-white resize-none focus:outline-none focus:border-accent/50"
              value={promptDraft}
              onChange={e => setPromptDraft(e.target.value)}
              placeholder="e.g. 'Always write from a founder's POV. Prioritize contrarian angles over mainstream ones. Avoid motivational fluff — favour specific, practical insights.'"
              disabled={savingPrompt}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={savingPrompt} onClick={() => setPromptModalOpen(false)}>Cancel</Button>
              <Button
                disabled={savingPrompt}
                onClick={async () => { await handleSavePrompt(promptDraft); setPromptModalOpen(false) }}
                className="bg-accent text-white"
              >
                {savingPrompt ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : 'Save Prompt'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Head Talk draft modal ─────────────────────────────────────────────── */}
      {headTalkDraftPost && (
        <HeadTalkDraftModal
          post={headTalkDraftPost}
          onClose={() => setHeadTalkDraftPost(null)}
          onMarkedPosted={() => { setHeadTalkDraftPost(null); fetchIdeas() }}
          onVideoUploaded={(videoUrl) => setHeadTalkDraftPost((p: any) => p ? { ...p, status: 'RENDERED_PENDING', videoUrl } : null)}
        />
      )}
    </div>
  )
}
