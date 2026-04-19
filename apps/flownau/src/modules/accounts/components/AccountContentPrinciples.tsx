'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { Input } from '@/modules/shared/components/ui/Input'
import { Textarea } from '@/modules/shared/components/ui/Textarea'
import { toast } from 'sonner'

const DEFAULT_FORM = {
  name: '',
  systemPrompt: '',
  isDefault: false,
}

export default function AccountContentPrinciples({ accountId }: { accountId: string }) {
  const [principles, setPrinciples] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ ...DEFAULT_FORM })

  const fetchPrinciples = async () => {
    try {
      const res = await fetch(`/api/content-principles?accountId=${accountId}`)
      const data = await res.json()
      setPrinciples(data.principles || [])
    } catch {
      toast.error('Failed to load content principles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrinciples()
  }, [accountId])

  const handleSave = async () => {
    if (!formData.name || !formData.systemPrompt) return toast.error('Name and prompt are required')

    try {
      if (editingId) {
        const res = await fetch(`/api/content-principles/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, ...formData }),
        })
        if (!res.ok) throw new Error()
        toast.success('Principles updated')
      } else {
        const res = await fetch('/api/content-principles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, ...formData }),
        })
        if (!res.ok) throw new Error()
        toast.success('Principles created')
      }
      setEditingId(null)
      setFormData({ ...DEFAULT_FORM })
      fetchPrinciples()
    } catch {
      toast.error('Failed to save principles')
    }
  }

  const handleEdit = (p: any) => {
    setEditingId(p.id)
    setFormData({ name: p.name, systemPrompt: p.systemPrompt, isDefault: p.isDefault })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete these principles?')) return
    try {
      await fetch(`/api/content-principles/${id}`, { method: 'DELETE' })
      toast.success('Deleted')
      fetchPrinciples()
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (loading) return <p className="text-text-secondary text-sm">Loading...</p>

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-heading font-semibold">Content Creation Principles</h2>
          <p className="text-text-secondary text-sm mt-1">
            Creative best-practices fed to the composer AI during content development.
          </p>
        </div>
        {!editingId && (
          <Button
            size="sm"
            onClick={() => {
              setEditingId('new')
              setFormData({ ...DEFAULT_FORM })
            }}
          >
            + Add Principles
          </Button>
        )}
      </div>

      {editingId && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">
            {editingId === 'new' ? 'New Principles' : 'Edit Principles'}
          </h3>
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Viral Hook Framework, Educational Engagement"
          />
          <div>
            <label className="form-label mb-1 block">
              System Prompt
              <span className="text-xs font-normal ml-2 opacity-70">
                Engagement and virality principles the AI applies when composing content.
              </span>
            </label>
            <Textarea
              value={formData.systemPrompt}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              rows={8}
              className="bg-gray-950 border border-border text-white w-full rounded p-3 text-sm"
              placeholder="Start every video with a pattern interrupt. Prioritize emotional resonance over information density..."
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-sm">Set as default</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave}>Save</Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditingId(null)
                setFormData({ ...DEFAULT_FORM })
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {principles.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.isDefault && (
                    <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-text-secondary text-xs line-clamp-3 mt-1">{p.systemPrompt}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => handleEdit(p)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(p.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {principles.length === 0 && !editingId && (
          <p className="text-text-secondary text-sm">
            No principles yet. Create your first set of content creation principles.
          </p>
        )}
      </div>
    </div>
  )
}
