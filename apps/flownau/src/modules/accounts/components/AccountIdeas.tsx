'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, Wand2, CheckCircle2, Trash2 } from 'lucide-react'

// Simple helper to load available templates to pass to compose (UI feedback)
export default function AccountIdeas({ accountId }: { accountId: string }) {
  const [ideas, setIdeas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)

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

  useEffect(() => {
    fetchIdeas()
  }, [accountId])

  const handleGenerate = async () => {
    setGenerating(true)
    const toastId = toast.loading('Consulting Brand Persona & generating 5 ideas...')
    try {
      const res = await fetch('/api/agent/idea-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
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
    const toastId = toast.loading('Converting Idea into a Composition Template Layout...')
    try {
      // Create composition
      const res = await fetch('/api/agent/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          prompt: idea.ideaText,
          format: 'reel',
          ideaId: idea.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Composition failed')

      toast.success('Idea structurally mapped into a Draft Composition!', { id: toastId })
      fetchIdeas()
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setApproving(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-heading font-semibold">Content Backlog</h3>
        <Button onClick={handleGenerate} disabled={generating} className="flex gap-2">
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wand2 className="w-4 h-4" />
          )}
          Brainstorm Ideas
        </Button>
      </div>

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

              <div className="flex gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0 justify-end">
                {!isUsed && (
                  <>
                    <Button
                      variant="outline"
                      className="border-red-900 text-red-500 hover:bg-red-950"
                      onClick={() => handleDelete(idea.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      disabled={approving === idea.id}
                      className="bg-accent text-white hover:bg-accent/80 flex gap-2"
                      onClick={() => handleApprove(idea)}
                    >
                      {approving === idea.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {isPending ? 'Approve & Compose' : 'Compose Template Target'}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
