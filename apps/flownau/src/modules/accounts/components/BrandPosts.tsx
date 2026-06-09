'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import HeadTalkDraftModal from './HeadTalkDraftModal'
import { PromptHistoryPanel } from './PromptHistoryPanel'
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
  ChevronLeft,
  ChevronRight,
  X,
  Shuffle,
  ScrollText,
  Lightbulb,
} from 'lucide-react'
import Modal from '@/modules/shared/components/Modal'
import PromptsModal from './PromptsModal'
import { cn } from '@/modules/shared/utils'

// ── Badge configs ─────────────────────────────────────────────────────────────

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

const FORMAT_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> =
  {
    reel: {
      label: 'Reel',
      icon: Film,
      className: 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
    },
    trial_reel: {
      label: 'Trial Reel',
      icon: Play,
      className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    },
    head_talk: {
      label: 'Head Talk',
      icon: Mic,
      className: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
    },
    carousel: {
      label: 'Carousel',
      icon: LayoutGrid,
      className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    },
    static_post: {
      label: 'Static Post',
      icon: ImageIcon,
      className: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
    },
    story: {
      label: 'Story',
      icon: Play,
      className: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
    },
  }

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  IDEA_PENDING: {
    label: 'Pending',
    className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  },
  IDEA_APPROVED: {
    label: 'Approved',
    className: 'bg-green-500/10 text-green-400 border border-green-500/20',
  },
  USED: { label: 'Used', className: 'bg-gray-500/10 text-gray-500 border border-gray-700' },
}

function Badge({
  label,
  icon: Icon,
  className,
}: {
  label: string
  icon?: React.ElementType
  className: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase',
        className,
      )}
    >
      {Icon && <Icon size={10} />}
      {label}
    </span>
  )
}

// ── Idea detail modal ─────────────────────────────────────────────────────────

function IdeaModal({
  idea,
  ideas,
  editText,
  setEditText,
  savingEdit,
  deletingIdea,
  approving,
  onClose,
  onNavigate,
  onDelete,
  onSave,
  onApprove,
  onDraft,
  onReformat,
  onShowPrompts,
}: {
  idea: any | null
  ideas: any[]
  editText: string
  setEditText: (t: string) => void
  savingEdit: boolean
  deletingIdea: boolean
  approving: string | null
  onClose: () => void
  onNavigate: (idea: any) => void
  onDelete: () => void
  onSave: () => void
  onApprove: () => void
  onDraft: (idea: any) => void
  onReformat: (idea: any) => void
  onShowPrompts: (idea: any) => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const idx = idea ? ideas.findIndex((i) => i.id === idea.id) : -1
  const total = ideas.length

  const goTo = useCallback(
    (nextIdx: number) => {
      const target = ideas[nextIdx]
      if (target) onNavigate(target)
    },
    [ideas, onNavigate],
  )

  // Keyboard navigation
  useEffect(() => {
    if (!idea) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && idx > 0) goTo(idx - 1)
      if (e.key === 'ArrowRight' && idx < total - 1) goTo(idx + 1)
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [idea, idx, total, goTo, onClose])

  // Lock scroll
  useEffect(() => {
    if (!idea) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [!!idea])

  if (!idea || !mounted) return null

  const statusCfg = STATUS_CONFIG[idea.status]
  const sourceCfg = SOURCE_CONFIG[idea.source] ?? SOURCE_CONFIG.automatic
  const formatCfg = idea.format ? FORMAT_CONFIG[idea.format] : null
  const hasUnsaved = editText !== idea.ideaText

  const modal = (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-4 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      {/* Card + flanking arrows */}
      <div className="relative z-10 w-full max-w-xl flex items-center">
        {/* Left nav arrow */}
        <button
          onClick={() => goTo(idx - 1)}
          disabled={idx <= 0}
          className="absolute -left-16 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all backdrop-blur-sm shadow-lg"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Right nav arrow */}
        <button
          onClick={() => goTo(idx + 1)}
          disabled={idx >= total - 1}
          className="absolute -right-16 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all backdrop-blur-sm shadow-lg"
        >
          <ChevronRight size={24} />
        </button>

        {/* Card */}
        <div className="relative w-full bg-panel border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] rounded-[2.5rem] glass overflow-hidden">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-6 top-6 z-20 rounded-full p-2 text-text-secondary hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>

          <div className="p-8 flex flex-col gap-5">
            {/* Header */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-heading font-semibold">Idea</h2>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {statusCfg && <Badge label={statusCfg.label} className={statusCfg.className} />}
                <Badge
                  label={sourceCfg.label}
                  icon={sourceCfg.icon}
                  className={sourceCfg.className}
                />
                {formatCfg && (
                  <Badge
                    label={formatCfg.label}
                    icon={formatCfg.icon}
                    className={formatCfg.className}
                  />
                )}
                {idea.aiLinked && (
                  <Badge
                    label="AI-Linked"
                    icon={Brain}
                    className="bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  />
                )}
              </div>
            </div>

            {/* Editable text */}
            <textarea
              className="w-full bg-gray-950 border border-border text-white rounded-lg p-3 text-sm min-h-[180px] resize-y focus:outline-none focus:border-accent/50"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              disabled={savingEdit || deletingIdea}
            />

            {/* Actions row */}
            <div className="flex items-center gap-2">
              <button
                disabled={deletingIdea || savingEdit}
                onClick={onDelete}
                className="flex items-center gap-1.5 text-sm text-red-400/70 hover:text-red-400 disabled:opacity-40 transition-colors"
              >
                {deletingIdea ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Delete
              </button>
              <div className="flex-1" />
              {idea.llmTrace && Object.keys(idea.llmTrace).length > 0 && (
                <button
                  onClick={() => onShowPrompts(idea)}
                  className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-white transition-colors"
                >
                  <ScrollText size={14} />
                  Prompts
                </button>
              )}
              <button
                disabled={savingEdit || deletingIdea}
                onClick={onClose}
                className="text-sm text-text-secondary hover:text-white transition-colors px-1 disabled:opacity-40"
              >
                Cancel
              </button>
              <Button
                disabled={savingEdit || deletingIdea || !editText.trim() || !hasUnsaved}
                onClick={onSave}
                className="bg-accent text-white hover:bg-accent/80"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>

            {/* Bottom action */}
            {idea.status === 'IDEA_PENDING' && (
              <div className="pt-2 border-t border-white/5">
                <Button
                  disabled={approving === idea.id}
                  onClick={onApprove}
                  className="w-full bg-green-700/80 hover:bg-green-700 text-white"
                >
                  {approving === idea.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Approve
                </Button>
              </div>
            )}
            {(idea.status === 'IDEA_APPROVED' || idea.status === 'USED') && (
              <div className="pt-2 border-t border-white/5 flex gap-2">
                {idea.status === 'USED' && (
                  <Button
                    onClick={() => onReformat(idea)}
                    variant="outline"
                    className="flex-1 text-white border-white/10 hover:bg-white/5"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    Re-format
                  </Button>
                )}
                <Button
                  onClick={() => onDraft(idea)}
                  className={cn(
                    'text-white',
                    idea.status === 'USED'
                      ? 'flex-1 bg-gray-700 hover:bg-gray-600'
                      : 'w-full bg-accent hover:bg-accent/80',
                  )}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  {idea.status === 'USED' ? 'Redo Draft' : 'Draft'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* end card wrapper */}

      {/* Counter */}
      <span className="relative z-10 text-sm text-white/40 tabular-nums select-none">
        {idx + 1} of {total}
      </span>
    </div>
  )

  return createPortal(modal, document.body)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BrandPosts({
  brandId,
  workspaceId,
}: {
  brandId: string
  workspaceId: string
}) {
  const router = useRouter()
  const [ideas, setIdeas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [composingIdea, setComposingIdea] = useState<any | null>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [headTalkDraftPost, setHeadTalkDraftPost] = useState<any | null>(null)

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkApproving, setBulkApproving] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Brainstorm modal
  const [brainstormOpen, setBrainstormOpen] = useState(false)
  const [brainstormConcept, setBrainstormConcept] = useState('')
  const [brainstormCount, setBrainstormCount] = useState<number | ''>('')
  const [brainstormSource, setBrainstormSource] = useState<'manual' | 'automatic'>('manual')

  // Ideation prompt — savedIdeationPrompt is the DB value; ideationCustomPrompt is the per-generation editable copy
  const [savedIdeationPrompt, setSavedIdeationPrompt] = useState('')
  const [ideationCustomPrompt, setIdeationCustomPrompt] = useState('')
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [promptDraft, setPromptDraft] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [brainstormShowPrompt, setBrainstormShowPrompt] = useState(false)
  // Composer prompt — savedComposerPrompt is the DB value; draftCustomPrompt is the per-generation editable copy
  const [savedComposerPrompt, setSavedComposerPrompt] = useState('')
  const [draftCustomPrompt, setDraftCustomPrompt] = useState('')
  const [composeShowPrompt, setComposeShowPrompt] = useState(false)

  // Re-format modal
  const [reformatIdea, setReformatIdea] = useState<any | null>(null)
  const [promptsIdea, setPromptsIdea] = useState<any | null>(null)
  const [reformatMode, setReformatMode] = useState<'format' | 'template'>('format')
  const [reformatFormat, setReformatFormat] = useState('')
  const [reformatTemplateId, setReformatTemplateId] = useState('')

  // Idea detail modal
  const [openIdea, setOpenIdea] = useState<any | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingIdea, setDeletingIdea] = useState(false)
  const [sourceConceptCache, setSourceConceptCache] = useState<Record<string, string | null>>({})
  const [activeSourceConceptId, setActiveSourceConceptId] = useState<string | null>(null)

  const toggleSourceConcept = async (id: string) => {
    if (activeSourceConceptId === id) {
      setActiveSourceConceptId(null)
      return
    }
    setActiveSourceConceptId(id)
    if (id in sourceConceptCache) return
    const res = await fetch(`/api/source-concepts/${id}`)
    const data = res.ok ? await res.json() : null
    setSourceConceptCache((prev) => ({ ...prev, [id]: data?.content ?? null }))
  }

  const fetchIdeationPrompt = async () => {
    try {
      const res = await fetch(`/api/brands/${brandId}`)
      const data = await res.json()
      const ip = data.brand?.ideationCustomPrompt ?? ''
      const cp = data.brand?.draftCustomPrompt ?? ''
      setSavedIdeationPrompt(ip)
      setIdeationCustomPrompt(ip)
      setSavedComposerPrompt(cp)
      setDraftCustomPrompt(cp)
    } catch {}
  }

  const handleSavePrompt = async (text: string) => {
    setSavingPrompt(true)
    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideationCustomPrompt: text || null }),
      })
      if (!res.ok) throw new Error()
      setSavedIdeationPrompt(text)
      setIdeationCustomPrompt(text)
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
    fetch(`/api/account-templates?brandId=${brandId}`)
      .then((r) => r.json())
      .then((d) => {
        const fetched = d.templates || []
        const enabledBrandTemplates = fetched.filter(
          (t: any) => t.brandId === brandId && t.brandConfigs?.[0]?.enabled === true
        )
        setTemplates(enabledBrandTemplates)
      })
      .catch(() => {})
  }, [brandId])

  // ── Selection helpers ───────────────────────────────────────────────────────

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  const selectAll = () => setSelected(new Set(ideas.map((i) => i.id)))

  const selectBatch = (batchIdeas: any[]) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const idea of batchIdeas) next.add(idea.id)
      return next
    })
  }

  // Group ideas by generationBatchId, newest batch first
  const batches: { batchId: string | null; label: string; ideas: any[] }[] = (() => {
    const map = new Map<string, any[]>()
    for (const idea of ideas) {
      const key = idea.generationBatchId ?? '__manual__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(idea)
    }
    return [...map.entries()]
      .map(([key, batchIdeas]) => {
        const newest = batchIdeas.reduce((a, b) =>
          new Date(a.createdAt) > new Date(b.createdAt) ? a : b,
        )
        const date = new Date(newest.createdAt)
        const label =
          key === '__manual__'
            ? 'Individual & Captured'
            : date.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
        return {
          batchId: key === '__manual__' ? null : key,
          label,
          ideas: batchIdeas,
          _newestMs: date.getTime(),
        }
      })
      .sort((a, b) => {
        if (a.batchId === null) return 1
        if (b.batchId === null) return -1
        return b._newestMs - a._newestMs
      })
  })()

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setDeletingIdea(true)
    try {
      await fetch(`/api/ideas/${id}`, { method: 'DELETE' })
      setIdeas((prev) => prev.filter((i) => i.id !== id))
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
      setOpenIdea((prev: any) =>
        prev?.id === idea.id ? { ...prev, status: 'IDEA_APPROVED' } : prev,
      )
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setApproving(null)
    }
  }

  const handleBulkApprove = async () => {
    const ids = [...selected].filter(
      (id) => ideas.find((i) => i.id === id)?.status === 'IDEA_PENDING',
    )
    if (!ids.length) return toast.info('No pending ideas in selection')
    setBulkApproving(true)
    const toastId = toast.loading(`Approving ${ids.length} ideas…`)
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/ideas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'IDEA_APPROVED' }),
          }),
        ),
      )
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
      await Promise.all([...selected].map((id) => fetch(`/api/ideas/${id}`, { method: 'DELETE' })))
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
      setOpenIdea((prev: any) => (prev ? { ...prev, ideaText: editText } : prev))
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleGenerate = async () => {
    if (brainstormSource === 'manual' && !brainstormConcept.trim()) {
      toast.error('Please enter a topic.')
      return
    }
    // Close modal immediately — generation runs in background
    const concept = brainstormConcept
    const count = brainstormCount
    const source = brainstormSource
    setBrainstormOpen(false)
    setBrainstormConcept('')
    setBrainstormCount('')
    const toastId = toast.loading(
      source === 'automatic'
        ? 'Generating ideas from InspoBase…'
        : `Generating ideas: "${concept.slice(0, 40)}…"`,
    )
    try {
      const res = await fetch('/api/agent/idea-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          topic: source === 'manual' ? concept : undefined,
          count: count || undefined,
          source,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(`${data.ideas?.length ?? 0} new ideas ready!`, { id: toastId, duration: 6000 })
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  const handleCompose = async () => {
    if (!composingIdea) return
    // Close modal immediately — generation runs in background
    const idea = composingIdea
    const templateId = selectedTemplateId
    setComposingIdea(null)
    setOpenIdea(null)
    const toastId = toast.loading('Composing draft…')
    try {
      // Resolve format + template: explicit template > idea format; let backend pick enabled template
      let finalFormat: string = idea.format ?? ''
      let resolvedTemplateId: string = templateId
      if (resolvedTemplateId) {
        finalFormat = templates.find((t) => t.id === resolvedTemplateId)?.format ?? finalFormat
      }
      if (!finalFormat) {
        finalFormat = 'reel'
      }
      const res = await fetch('/api/agent/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          prompt: idea.ideaText,
          format: finalFormat,
          postId: idea.id,
          templateId: resolvedTemplateId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Composition failed')
      fetchIdeas()
      if (finalFormat === 'head_talk' && data.post) {
        setHeadTalkDraftPost(data.post)
        toast.success('Draft ready!', { id: toastId, duration: 8000 })
      } else if (data.post?.id) {
        toast.success('Draft ready!', {
          id: toastId,
          duration: 10000,
          action: {
            label: 'View draft',
            onClick: () => router.push(`/dashboard/workspace/${workspaceId}/draft/${data.post.id}`),
          },
        })
      } else {
        toast.success('Draft generated!', { id: toastId, duration: 6000 })
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  const handleReformat = async () => {
    if (!reformatIdea) return
    const finalTemplateId = reformatMode === 'template' ? reformatTemplateId : undefined
    const finalFormat = reformatMode === 'format' ? reformatFormat : undefined

    if (!finalTemplateId && !finalFormat) {
      toast.error('Select a format or template')
      return
    }

    // Close modal immediately — generation runs in background
    const idea = reformatIdea
    setReformatIdea(null)
    setOpenIdea(null)
    const toastId = toast.loading('Re-composing draft…')
    try {
      const res = await fetch('/api/agent/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          prompt: idea.ideaText,
          format: finalFormat || undefined,
          postId: idea.id,
          templateId: finalTemplateId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Re-compose failed')
      fetchIdeas()
      if ((finalFormat || data.post?.format) === 'head_talk' && data.post) {
        setHeadTalkDraftPost(data.post)
        toast.success('Draft ready!', { id: toastId, duration: 8000 })
      } else if (data.post?.id) {
        toast.success('Draft re-composed!', {
          id: toastId,
          duration: 10000,
          action: {
            label: 'View draft',
            onClick: () => router.push(`/dashboard/workspace/${workspaceId}/draft/${data.post.id}`),
          },
        })
      } else {
        toast.success('Draft re-composed!', { id: toastId, duration: 6000 })
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  const pendingCount = ideas.filter((i) => i.status === 'IDEA_PENDING').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-heading font-semibold">Content Backlog</h3>
          <p className="text-xs text-text-secondary">
            Captured ideas first, then manual, then automatic.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {ideas.length > 0 &&
            (selected.size === ideas.length ? (
              <button
                onClick={clearSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
              >
                <Square size={12} /> Clear selection
              </button>
            ) : (
              <button
                onClick={selectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
              >
                <CheckSquare size={12} /> Select all
              </button>
            ))}
          <button
            onClick={() => {
              setPromptDraft(ideationCustomPrompt)
              setPromptModalOpen(true)
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              ideationCustomPrompt
                ? 'text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20'
                : 'text-text-secondary border-white/10 hover:text-white hover:bg-white/5',
            )}
          >
            <SlidersHorizontal size={12} />
            {ideationCustomPrompt ? 'Prompt set' : 'Set prompt'}
          </button>
          <Button
            onClick={() => setBrainstormOpen(true)}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          >
            <Wand2 className="w-4 h-4" />
            Brainstorm
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-accent/10 border border-accent/20 text-sm">
          <span className="text-accent font-medium">{selected.size} selected</span>
          <button
            onClick={clearSelection}
            className="text-text-secondary hover:text-white text-xs transition-colors"
          >
            Clear
          </button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            disabled={bulkApproving}
            onClick={handleBulkApprove}
            className="text-green-400 border-green-900 hover:bg-green-950 text-xs"
          >
            {bulkApproving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkDeleting}
            onClick={handleBulkDelete}
            className="text-red-400 border-red-900 hover:bg-red-950 text-xs"
          >
            {bulkDeleting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            Delete
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && ideas.length === 0 && (
        <div className="text-center py-16 text-text-secondary border border-dashed border-white/10 rounded-lg">
          <Brain size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">
            No ideas yet. Hit <strong>Brainstorm</strong> to generate some.
          </p>
        </div>
      )}

      {/* Ideas grouped by batch */}
      {batches.map(({ batchId, label, ideas: batchIdeas }) => {
        const allSelected = batchIdeas.every((i) => selected.has(i.id))
        const batchSourceRef = batchIdeas[0]?.sourceRef ?? null
        const isConceptOpen = batchSourceRef && activeSourceConceptId === batchSourceRef
        const conceptText = batchSourceRef ? sourceConceptCache[batchSourceRef] : undefined
        return (
          <div key={batchId ?? '__manual__'} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">
                {label}
              </span>
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[11px] text-text-secondary">
                {batchIdeas.length} idea{batchIdeas.length !== 1 ? 's' : ''}
              </span>
              {batchSourceRef && (
                <button
                  onClick={() => toggleSourceConcept(batchSourceRef)}
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] transition-colors whitespace-nowrap',
                    isConceptOpen ? 'text-accent' : 'text-text-secondary hover:text-white',
                  )}
                  title="View source concept"
                >
                  <Lightbulb size={11} />
                  Source
                </button>
              )}
              <button
                onClick={() =>
                  allSelected
                    ? batchIdeas.forEach((i) =>
                        setSelected((prev) => {
                          const n = new Set(prev)
                          n.delete(i.id)
                          return n
                        }),
                      )
                    : selectBatch(batchIdeas)
                }
                className="text-[11px] text-text-secondary hover:text-white transition-colors whitespace-nowrap"
              >
                {allSelected ? 'Deselect' : 'Select batch'}
              </button>
            </div>
            {isConceptOpen && (
              <div className="text-[12px] text-text-secondary bg-white/5 border border-white/10 rounded-lg px-3 py-2 leading-relaxed">
                {conceptText === undefined ? 'Loading…' : (conceptText ?? 'Concept not found.')}
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {batchIdeas.map((idea) => {
                const isUsed = idea.status === 'USED'
                const isPending = idea.status === 'IDEA_PENDING'
                const isSelected = selected.has(idea.id)
                const statusCfg = STATUS_CONFIG[idea.status]
                const sourceCfg = SOURCE_CONFIG[idea.source] ?? SOURCE_CONFIG.automatic

                return (
                  <Card
                    key={idea.id}
                    onClick={() => {
                      setOpenIdea(idea)
                      setEditText(idea.ideaText)
                    }}
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
                      {isSelected ? (
                        <CheckSquare size={15} className="text-accent" />
                      ) : (
                        <Square size={15} className="opacity-30 hover:opacity-100" />
                      )}
                    </button>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 pr-6">
                      {statusCfg && (
                        <Badge label={statusCfg.label} className={statusCfg.className} />
                      )}
                      <Badge
                        label={sourceCfg.label}
                        icon={sourceCfg.icon}
                        className={sourceCfg.className}
                      />
                      {idea.format &&
                        (() => {
                          const fc = FORMAT_CONFIG[idea.format]
                          return fc ? (
                            <Badge label={fc.label} icon={fc.icon} className={fc.className} />
                          ) : null
                        })()}
                      {idea.aiLinked && (
                        <Badge
                          label="AI-Linked"
                          icon={Brain}
                          className="bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        />
                      )}
                    </div>

                    {/* Idea text */}
                    <p className="text-sm text-white/90 leading-relaxed line-clamp-4">
                      {idea.ideaText}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <span className="text-[10px] text-text-secondary">
                        {new Date(idea.createdAt).toLocaleDateString('en-GB')}
                      </span>
                      {isPending && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleApprove(idea)
                          }}
                          disabled={approving === idea.id}
                          className="flex items-center gap-1 text-[11px] font-semibold text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                        >
                          {approving === idea.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={11} />
                          )}
                          Approve
                        </button>
                      )}
                      {(idea.status === 'IDEA_APPROVED' || isUsed) && (
                        <div className="flex items-center gap-2">
                          {isUsed && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setReformatIdea(idea)
                                setReformatMode('format')
                                setReformatFormat('')
                                setReformatTemplateId('')
                              }}
                              className="flex items-center gap-1 text-[11px] font-semibold text-text-secondary hover:text-white transition-colors"
                            >
                              <Shuffle size={11} />
                              Re-format
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setComposingIdea(idea)
                            }}
                            className={cn(
                              'flex items-center gap-1 text-[11px] font-semibold transition-colors',
                              isUsed
                                ? 'text-text-secondary hover:text-white'
                                : 'text-accent hover:text-accent/80',
                            )}
                          >
                            <Wand2 size={11} />
                            {isUsed ? 'Redo Draft' : 'Draft'}
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* ── Idea detail modal ─────────────────────────────────────────────────── */}
      <IdeaModal
        idea={openIdea}
        ideas={ideas}
        editText={editText}
        setEditText={setEditText}
        savingEdit={savingEdit}
        deletingIdea={deletingIdea}
        approving={approving}
        onClose={() => !savingEdit && !deletingIdea && setOpenIdea(null)}
        onNavigate={(idea) => {
          setOpenIdea(idea)
          setEditText(idea.ideaText)
        }}
        onDelete={() => handleDelete(openIdea?.id)}
        onSave={handleSaveEdit}
        onApprove={() => openIdea && handleApprove(openIdea)}
        onDraft={(idea) => {
          setComposingIdea(idea)
          setOpenIdea(null)
        }}
        onReformat={(idea) => {
          setReformatIdea(idea)
          setReformatMode('format')
          setReformatFormat('')
          setReformatTemplateId('')
          setOpenIdea(null)
        }}
        onShowPrompts={(idea) => setPromptsIdea(idea)}
      />

      {promptsIdea?.llmTrace && (
        <PromptsModal llmTrace={promptsIdea.llmTrace} onClose={() => setPromptsIdea(null)} />
      )}

      {/* ── Brainstorm modal ──────────────────────────────────────────────────── */}
      {brainstormOpen && (
        <Modal isOpen={true} onClose={() => setBrainstormOpen(false)}>
          <div className="space-y-4">
            <h2 className="text-xl font-heading font-semibold">Brainstorm Ideas</h2>
            <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
              {(['manual', 'automatic'] as const).map((src) => (
                <button
                  key={src}
                  onClick={() => setBrainstormSource(src)}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5',
                    brainstormSource === src
                      ? 'bg-gray-800 text-white'
                      : 'text-text-secondary hover:text-white',
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
                className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm min-h-[100px] resize-y"
                value={brainstormConcept}
                onChange={(e) => setBrainstormConcept(e.target.value)}
                placeholder="What's the concept or topic to explore?&#10;e.g. 'How AI is changing content creation for small brands'"
              />
            ) : (
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-4">
                <p className="text-xs text-purple-200/70 leading-relaxed">
                  The AI will consume the latest <strong>Mechanical Digest</strong> from
                  Nauthenticity&apos;s InspoBase and generate non-repetitive ideas.
                </p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <label className="text-xs text-text-secondary whitespace-nowrap">
                Count (leave blank — AI decides)
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
                className="w-20 bg-gray-900 border border-gray-800 text-white rounded p-2 text-sm"
              />
            </div>
            <div>
              <button
                onClick={() => setBrainstormShowPrompt((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  ideationCustomPrompt
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text-secondary hover:text-white',
                )}
              >
                <SlidersHorizontal size={11} />
                {ideationCustomPrompt ? 'Ideation prompt set' : 'Add ideation prompt'}
                <ChevronDown
                  size={11}
                  className={cn('transition-transform', brainstormShowPrompt && 'rotate-180')}
                />
              </button>
              {brainstormShowPrompt && (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    value={ideationCustomPrompt}
                    onChange={(e) => setIdeationCustomPrompt(e.target.value)}
                    placeholder={
                      "What angles, constraints or filters should shape the ideas?\n\ne.g. 'Focus on founder-led, behind-the-scenes content. Avoid motivational clichés. Ideas should resonate with early-stage founders, not investors. Never suggest list-based formats.'"
                    }
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs text-white resize-y min-h-[80px]"
                  />
                  {ideationCustomPrompt !== savedIdeationPrompt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIdeationCustomPrompt(savedIdeationPrompt)}
                      className="self-end text-xs text-amber-400 border-amber-500/30"
                    >
                      Reset to saved
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBrainstormOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Ideas
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Compose modal ─────────────────────────────────────────────────────── */}
      {composingIdea && (
        <Modal isOpen={true} onClose={() => setComposingIdea(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-heading font-semibold">Draft</h2>
              {composingIdea.source &&
                (() => {
                  const sc = SOURCE_CONFIG[composingIdea.source]
                  return sc ? (
                    <Badge label={sc.label} icon={sc.icon} className={sc.className} />
                  ) : null
                })()}
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 max-h-[120px] overflow-y-auto">
              <p className="text-xs text-gray-400 whitespace-pre-wrap">{composingIdea.ideaText}</p>
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Target Template</label>
              <select
                className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">Auto Select</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <button
                onClick={() => setComposeShowPrompt((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  draftCustomPrompt
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text-secondary hover:text-white',
                )}
              >
                <SlidersHorizontal size={11} />
                {draftCustomPrompt ? 'Composer prompt set' : 'Composer prompt'}
                <ChevronDown
                  size={11}
                  className={cn('transition-transform', composeShowPrompt && 'rotate-180')}
                />
              </button>
              {composeShowPrompt && (
                <div className="mt-2 space-y-2">
                  <textarea
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs min-h-[80px] resize-y"
                    value={draftCustomPrompt}
                    onChange={(e) => setDraftCustomPrompt(e.target.value)}
                    placeholder={
                      "How should scripts be written for this brand?\n\ne.g. 'Open with a provocative statement, never a question. Max 3 short paragraphs. Conversational but direct. Never end with a call to action — let the point land on its own.'"
                    }
                  />
                  {draftCustomPrompt !== savedComposerPrompt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDraftCustomPrompt(savedComposerPrompt)}
                      className="self-end text-xs text-amber-400 border-amber-500/30"
                    >
                      Reset to saved
                    </Button>
                  )}
                  <PromptHistoryPanel
                    entityType="brand"
                    entityId={brandId}
                    field="draftCustomPrompt"
                    onRestore={(content) => setDraftCustomPrompt(content)}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setComposingIdea(null)}>
                Cancel
              </Button>
              <Button onClick={handleCompose} className="bg-accent text-white">
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Draft
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Re-format modal ───────────────────────────────────────────────────── */}
      {reformatIdea && (
        <Modal isOpen={true} onClose={() => setReformatIdea(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-white/60" />
              <h2 className="text-xl font-heading font-semibold">Re-compose Draft</h2>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 max-h-[100px] overflow-y-auto">
              <p className="text-xs text-gray-400 whitespace-pre-wrap">{reformatIdea.ideaText}</p>
            </div>
            {/* Mode tabs */}
            <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
              {(['format', 'template'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setReformatMode(mode)
                    setReformatFormat('')
                    setReformatTemplateId('')
                  }}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-bold rounded-md transition-all',
                    reformatMode === mode
                      ? 'bg-gray-800 text-white'
                      : 'text-text-secondary hover:text-white',
                  )}
                >
                  {mode === 'format' ? 'By Format' : 'Specific Template'}
                </button>
              ))}
            </div>
            
            {(() => {
              const availableTemplates = templates.filter(t => t.id !== reformatIdea.templateId)
              return reformatMode === 'format' ? (
                <div>
                  <label className="text-xs text-text-secondary block mb-2">
                    Choose a format — a template will be picked at random
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(availableTemplates.map((t) => t.format).filter(Boolean))].map((fmt) => {
                      const fc = FORMAT_CONFIG[fmt]
                      const Icon = fc?.icon
                      return (
                        <button
                          key={fmt}
                          onClick={() => setReformatFormat(fmt === reformatFormat ? '' : fmt)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                            reformatFormat === fmt
                              ? 'bg-accent border-accent text-white'
                              : 'border-white/10 text-text-secondary hover:border-white/30 hover:text-white',
                          )}
                        >
                          {Icon && <Icon size={12} />}
                          {fc?.label ?? fmt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-text-secondary block mb-1">Choose a template</label>
                  <select
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-sm"
                    value={reformatTemplateId}
                    onChange={(e) => setReformatTemplateId(e.target.value)}
                  >
                    <option value="">Select a template…</option>
                    {availableTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })()}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReformatIdea(null)}>
                Cancel
              </Button>
              <Button
                disabled={reformatMode === 'format' ? !reformatFormat : !reformatTemplateId}
                onClick={handleReformat}
                className="bg-accent text-white"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Re-compose
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
                Custom instructions injected into every idea generation — manual, brainstorm, and
                automatic. They take priority over all default guidelines.
              </p>
            </div>
            <textarea
              autoFocus
              className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-sm text-white resize-y min-h-[140px] focus:outline-none focus:border-accent/50"
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              placeholder={
                "What angles, constraints or filters should shape every idea generation for this brand?\n\n• Angle focus: e.g. 'Always lean into behind-the-scenes honesty'\n• Tone restriction: e.g. 'Avoid motivational clichés and self-help language'\n• Audience lens: e.g. 'Ideas must resonate with early-stage founders, not investors'\n• Format rules: e.g. 'Never suggest list-based or how-to content'\n• Priority topics: e.g. 'Prioritise product-led, specific and contrarian takes'"
              }
              disabled={savingPrompt}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={savingPrompt}
                onClick={() => setPromptModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={savingPrompt}
                onClick={async () => {
                  await handleSavePrompt(promptDraft)
                  setPromptModalOpen(false)
                }}
                className="bg-accent text-white"
              >
                {savingPrompt ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  'Save Prompt'
                )}
              </Button>
            </div>
            <PromptHistoryPanel
              entityType="brand"
              entityId={brandId}
              field="ideationCustomPrompt"
              onRestore={(content) => setPromptDraft(content)}
            />
          </div>
        </Modal>
      )}

      {/* ── Head Talk draft modal ─────────────────────────────────────────────── */}
      {headTalkDraftPost && (
        <HeadTalkDraftModal
          post={headTalkDraftPost}
          onClose={() => setHeadTalkDraftPost(null)}
          onMarkedPosted={() => {
            setHeadTalkDraftPost(null)
            fetchIdeas()
          }}
          onVideoUploaded={(videoUrl) =>
            setHeadTalkDraftPost((p: any) =>
              p ? { ...p, status: 'RENDERED_PENDING', videoUrl } : null,
            )
          }
        />
      )}
    </div>
  )
}
