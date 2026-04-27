'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react'

type Framework = {
  id: string
  name: string
  systemPrompt: string
  isDefault: boolean
}

const emptyForm = { name: '', systemPrompt: '', isDefault: false }

export default function AccountIdeasFrameworks({ brandId }: { brandId: string }) {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Framework | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchFrameworks = async () => {
    try {
      const res = await fetch(`/api/ideas-frameworks?brandId=${brandId}`)
      const data = await res.json()
      setFrameworks(data.frameworks || [])
    } catch {
      toast.error('Failed to load strategy frameworks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFrameworks()
  }, [brandId])

  const startEdit = (fw: Framework) => {
    setEditing(fw)
    setForm({ name: fw.name, systemPrompt: fw.systemPrompt, isDefault: fw.isDefault })
  }

  const startCreate = () => {
    setEditing(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.systemPrompt.trim()) {
      toast.error('Name and prompt are required')
      return
    }
    setSaving(true)
    try {
      const method = editing ? 'PUT' : 'POST'
      const url = editing ? `/api/ideas-frameworks/${editing.id}` : '/api/ideas-frameworks'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, ...form }),
      })
      if (!res.ok) throw new Error()
      toast.success(editing ? 'Strategy framework updated' : 'Strategy framework created')
      setForm(emptyForm)
      setEditing(null)
      fetchFrameworks()
    } catch {
      toast.error('Failed to save strategy framework')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this strategy framework?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/ideas-frameworks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Framework deleted')
      fetchFrameworks()
    } catch {
      toast.error('Failed to delete framework')
    } finally {
      setDeletingId(null)
    }
  }

  const isFormDirty = form.name.trim() || form.systemPrompt.trim()

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-heading font-semibold">Ideas Strategy Frameworks</h3>
          <p className="text-sm text-text-secondary mt-1">
            Frameworks instruct the AI how to generate content ideas during brainstorming. Select one
            from the Ideas tab when generating.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={startCreate} className="flex items-center gap-1.5 shrink-0">
          <Plus size={14} />
          New Framework
        </Button>
      </div>

      {/* Create / Edit form */}
      {(isFormDirty || editing !== null || frameworks.length === 0) && (
        <Card className="p-6 flex flex-col gap-4">
          <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            {editing ? 'Edit Framework' : 'New Framework'}
          </h4>

          <div className="space-y-1">
            <label className="text-xs text-gray-400">Framework Name</label>
            <input
              className="w-full bg-gray-950 border border-border rounded p-2 text-sm text-white"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Viral Educational Strategy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400 font-bold">Ideation Instructions</label>
            <textarea
              className="w-full bg-gray-950 border border-border rounded p-2 text-sm text-white min-h-[140px]"
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              placeholder="Instruct the AI how to think about new content ideas..."
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="rounded bg-gray-800 border-gray-700"
              />
              Set as Default Strategy
            </label>
            <div className="flex gap-2">
              {(editing || isFormDirty) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(null)
                    setForm(emptyForm)
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : editing ? (
                  'Update'
                ) : (
                  'Create'
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Framework list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-text-secondary" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {frameworks.map((fw) => (
            <Card key={fw.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{fw.name}</span>
                  {fw.isDefault && (
                    <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase bg-accent/10 text-accent border border-accent/20">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary line-clamp-2">{fw.systemPrompt}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(fw)}
                  className="border-gray-700 text-gray-400 hover:text-white"
                >
                  <Pencil size={13} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(fw.id)}
                  disabled={deletingId === fw.id}
                  className="border-red-900 text-red-500 hover:bg-red-950"
                >
                  {deletingId === fw.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </Button>
              </div>
            </Card>
          ))}
          {frameworks.length === 0 && !isFormDirty && (
            <div className="text-center py-8 text-text-secondary text-sm border border-dashed border-gray-800 rounded-lg">
              No strategy frameworks yet. Create one above.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
