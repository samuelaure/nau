'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { Input } from '@/modules/shared/components/ui/Input'
import { Textarea } from '@/modules/shared/components/ui/Textarea'
import { toast } from 'sonner'

export default function AccountPersonas({ accountId }: { accountId: string }) {
  const [personas, setPersonas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    systemPrompt: '',
    ideasFrameworkPrompt: '',
    isDefault: false,
    autoApproveIdeas: false,
    autoApproveCompositions: false,
  })

  // Load
  const fetchPersonas = async () => {
    try {
      const res = await fetch(`/api/personas?accountId=${accountId}`)
      const data = await res.json()
      setPersonas(data.personas || [])
    } catch (e) {
      toast.error('Failed to load personas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPersonas()
  }, [accountId])

  // Save (Create or Update)
  const handleSave = async () => {
    if (!formData.name) return toast.error('Name is required')

    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/personas/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, ...formData }),
        })
        if (!res.ok) throw new Error()
        toast.success('Persona updated')
      } else {
        // Create
        const res = await fetch(`/api/personas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, ...formData }),
        })
        if (!res.ok) throw new Error()
        toast.success('Persona created')
      }
      setEditingId(null)
      setFormData({
        name: '',
        systemPrompt: '',
        ideasFrameworkPrompt: '',
        isDefault: false,
        autoApproveIdeas: false,
        autoApproveCompositions: false,
      })
      fetchPersonas()
    } catch {
      toast.error('Failed to save persona')
    }
  }

  const handleEdit = (p: any) => {
    setEditingId(p.id)
    setFormData({
      name: p.name,
      systemPrompt: p.systemPrompt,
      ideasFrameworkPrompt: p.ideasFrameworkPrompt,
      isDefault: p.isDefault,
      autoApproveIdeas: p.autoApproveIdeas,
      autoApproveCompositions: p.autoApproveCompositions,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Persona?')) return
    try {
      const res = await fetch(`/api/personas/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Persona deleted')
      fetchPersonas()
    } catch {
      toast.error('Failed to delete persona')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-heading font-semibold">Brand Personas</h3>
        {!editingId && <Button onClick={() => setEditingId('')}>Create Persona</Button>}
      </div>

      {editingId !== null && (
        <Card className="bg-gray-900 border border-gray-800 p-6 flex flex-col gap-4">
          <h4 className="text-lg font-bold">{editingId ? 'Edit Persona' : 'New Persona'}</h4>
          <div className="space-y-1">
            <label className="text-sm text-gray-400">Persona Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-gray-950 border-gray-800 text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-400 text-bold block">
              1. Global Brand Voice (System Prompt)
            </label>
            <label className="text-xs text-gray-500 block pb-1">
              This governs Tone of Voice, identity constraints, emojis usage, and general brand
              constraints spanning ideas to outputs.
            </label>
            <Textarea
              value={formData.systemPrompt}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              className="bg-gray-950 border-gray-800 text-white"
              rows={4}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-400 text-bold block">
              2. Brainstorming Engine Framework
            </label>
            <label className="text-xs text-gray-500 block pb-1">
              This governs the structure for how the Brainstorm Engine queries topics. (E.g. "Focus
              strictly on educational SEO myths and fast hooks")
            </label>
            <Textarea
              value={formData.ideasFrameworkPrompt}
              onChange={(e) => setFormData({ ...formData, ideasFrameworkPrompt: e.target.value })}
              className="bg-gray-950 border-gray-800 text-white"
              rows={4}
            />
          </div>

          <div className="flex flex-wrap gap-4 mt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="rounded bg-gray-800 border-gray-700"
              />
              Is Default for Account
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-orange-400">
              <input
                type="checkbox"
                checked={formData.autoApproveIdeas}
                onChange={(e) => setFormData({ ...formData, autoApproveIdeas: e.target.checked })}
                className="rounded bg-gray-800 border-gray-700"
              />
              Auto-Approve Ideas
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-red-400">
              <input
                type="checkbox"
                checked={formData.autoApproveCompositions}
                onChange={(e) =>
                  setFormData({ ...formData, autoApproveCompositions: e.target.checked })
                }
                className="rounded bg-gray-800 border-gray-700"
              />
              Auto-Approve Final Compositions (Trusted Mode)
            </label>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Persona</Button>
          </div>
        </Card>
      )}

      {!loading && !editingId && personas.length === 0 && (
        <div className="text-center py-10 text-text-secondary">
          No personas attached to this account.
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-6">
        {personas.map((p) => (
          <Card key={p.id} className="bg-gray-900 border border-gray-800 p-5 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-bold flex items-center gap-2">
                  {p.name}
                  {p.isDefault && (
                    <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">
                      Default
                    </span>
                  )}
                </h4>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(p)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs text-red-500 hover:text-red-400 transition"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-500 line-clamp-3">
              <strong>System Prompt:</strong> {p.systemPrompt}
            </div>
            <div className="text-xs text-gray-500 line-clamp-2">
              <strong>Framework:</strong> {p.ideasFrameworkPrompt}
            </div>

            <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-gray-800">
              {p.autoApproveIdeas ? (
                <span className="text-[10px] text-green-400">✓ Auto-Approve Ideas</span>
              ) : (
                <span className="text-[10px] text-gray-600">✗ Manual Ideas Review</span>
              )}
              {p.autoApproveCompositions ? (
                <span className="text-[10px] text-red-400">✓ Auto-Publish Drafts</span>
              ) : (
                <span className="text-[10px] text-gray-600">✗ Manual Drafts Review</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
