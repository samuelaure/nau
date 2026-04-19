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
  modelSelection: 'GROQ_LLAMA_3_3' as any,
  isDefault: false,
  autoApproveIdeas: false,
  autoApproveCompositions: false,
  engine_autoApproveIdeas: false,
  capturedCount: 3,
  capturedAutoApprove: false,
  manualCount: 5,
  manualAutoApprove: false,
  automaticCount: 5,
  automaticAutoApprove: false,
}

export default function AccountPersonas({ accountId }: { accountId: string }) {
  const [personas, setPersonas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ ...DEFAULT_FORM })

  const fetchPersonas = async () => {
    try {
      const res = await fetch(`/api/personas?accountId=${accountId}`)
      const data = await res.json()
      setPersonas(data.personas || [])
    } catch {
      toast.error('Failed to load personas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPersonas()
  }, [accountId])

  const handleSave = async () => {
    if (!formData.name) return toast.error('Name is required')

    try {
      if (editingId) {
        const res = await fetch(`/api/personas/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, ...formData }),
        })
        if (!res.ok) throw new Error()
        toast.success('Persona updated')
      } else {
        const res = await fetch(`/api/personas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, ...formData }),
        })
        if (!res.ok) throw new Error()
        toast.success('Persona created')
      }
      setEditingId(null)
      setFormData({ ...DEFAULT_FORM })
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
      modelSelection: p.modelSelection,
      isDefault: p.isDefault,
      autoApproveIdeas: p.autoApproveIdeas,
      autoApproveCompositions: p.autoApproveCompositions,
      engine_autoApproveIdeas: p.engine_autoApproveIdeas ?? false,
      capturedCount: p.capturedCount ?? 3,
      capturedAutoApprove: p.capturedAutoApprove ?? false,
      manualCount: p.manualCount ?? 5,
      manualAutoApprove: p.manualAutoApprove ?? false,
      automaticCount: p.automaticCount ?? 5,
      automaticAutoApprove: p.automaticAutoApprove ?? false,
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

  const field = (key: keyof typeof DEFAULT_FORM) => ({
    value: formData[key] as any,
    onChange: (e: any) =>
      setFormData({
        ...formData,
        [key]:
          e.target.type === 'checkbox'
            ? e.target.checked
            : e.target.type === 'number'
              ? Number(e.target.value)
              : e.target.value,
      }),
  })

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
            <label className="text-sm text-gray-400 font-bold block">
              1. Global Brand Voice (System Prompt)
            </label>
            <label className="text-xs text-gray-500 block pb-1">
              Governs tone of voice, identity constraints, emoji usage, and general brand
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
            <label className="text-sm text-gray-400 block">AI Model Selection</label>
            <select
              value={formData.modelSelection}
              onChange={(e) => setFormData({ ...formData, modelSelection: e.target.value })}
              className="w-full bg-gray-950 border border-gray-800 text-white rounded p-2 text-sm"
            >
              <optgroup label="Groq (Fast)">
                <option value="GROQ_LLAMA_3_3">Llama 3.3 70B (Default)</option>
                <option value="GROQ_LLAMA_3_1_70B">Llama 3.1 70B</option>
                <option value="GROQ_LLAMA_3_1_8B">Llama 3.1 8B</option>
                <option value="GROQ_MIXTRAL_8X7B">Mixtral 8x7B</option>
                <option value="GROQ_DEEPSEEK_R1_70B">DeepSeek R1 Distill 70B</option>
              </optgroup>
              <optgroup label="OpenAI (Smart)">
                <option value="OPENAI_GPT_4O">GPT-4o ($5.00 / 1M tokens)</option>
                <option value="OPENAI_GPT_4O_MINI">GPT-4o Mini ($0.15 / 1M tokens)</option>
                <option value="OPENAI_GPT_4_TURBO">GPT-4 Turbo ($10.00 / 1M tokens)</option>
                <option value="OPENAI_GPT_4_1">GPT-4.1 ($10.00 / 1M tokens)</option>
                <option value="OPENAI_O1">O1 Preview ($15.00 / 1M tokens)</option>
                <option value="OPENAI_O1_MINI">O1 Mini ($3.00 / 1M tokens)</option>
              </optgroup>
            </select>
          </div>

          {/* Generation Rituals */}
          <div className="mt-2 border border-gray-800 rounded-lg p-4 flex flex-col gap-4">
            <div>
              <h5 className="text-sm font-bold text-gray-300 mb-1">Generation Rituals</h5>
              <p className="text-xs text-gray-500">
                Control how many ideas are generated per session and whether they require manual
                approval before entering the backlog.
              </p>
            </div>

            {/* Captured Origin */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold text-yellow-400 mb-0.5 uppercase tracking-widest">
                  Captured
                </p>
                <p className="text-[11px] text-gray-500">Ideas spawned from voice/capture input</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-gray-400 whitespace-nowrap">Count</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    {...field('capturedCount')}
                    className="w-14 bg-gray-950 border border-gray-800 text-white rounded p-1 text-sm text-center"
                  />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-300 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={formData.capturedAutoApprove}
                    onChange={(e) =>
                      setFormData({ ...formData, capturedAutoApprove: e.target.checked })
                    }
                    className="rounded bg-gray-800 border-gray-700"
                  />
                  Auto-Approve
                </label>
              </div>
            </div>

            {/* Manual Origin */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-400 mb-0.5 uppercase tracking-widest">
                  Manual
                </p>
                <p className="text-[11px] text-gray-500">Ideas from operator brainstorm sessions</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-gray-400 whitespace-nowrap">Count</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    {...field('manualCount')}
                    className="w-14 bg-gray-950 border border-gray-800 text-white rounded p-1 text-sm text-center"
                  />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-300 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={formData.manualAutoApprove}
                    onChange={(e) =>
                      setFormData({ ...formData, manualAutoApprove: e.target.checked })
                    }
                    className="rounded bg-gray-800 border-gray-700"
                  />
                  Auto-Approve
                </label>
              </div>
            </div>

            {/* Automatic Origin */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold text-purple-400 mb-0.5 uppercase tracking-widest">
                  Automatic
                </p>
                <p className="text-[11px] text-gray-500">Ideas from the autonomous cron engine</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-gray-400 whitespace-nowrap">Count</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    {...field('automaticCount')}
                    className="w-14 bg-gray-950 border border-gray-800 text-white rounded p-1 text-sm text-center"
                  />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-300 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={formData.automaticAutoApprove}
                    onChange={(e) =>
                      setFormData({ ...formData, automaticAutoApprove: e.target.checked })
                    }
                    className="rounded bg-gray-800 border-gray-700"
                  />
                  Auto-Approve
                </label>
              </div>
            </div>
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
            <label className="flex items-center gap-2 cursor-pointer text-sm text-amber-400">
              <input
                type="checkbox"
                checked={formData.engine_autoApproveIdeas}
                onChange={(e) =>
                  setFormData({ ...formData, engine_autoApproveIdeas: e.target.checked })
                }
                className="rounded bg-gray-800 border-gray-700"
              />
              Engine: Auto-Compose Ideas → Draft Pool (Phase 14)
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
            <div className="text-xs text-blue-400 mt-1 uppercase font-bold tracking-tighter">
              Model: {p.modelSelection}
            </div>

            {/* Ritual summary */}
            <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-gray-800">
              {[
                {
                  label: 'Captured',
                  count: p.capturedCount ?? 3,
                  auto: p.capturedAutoApprove ?? false,
                  color: 'text-yellow-400',
                },
                {
                  label: 'Manual',
                  count: p.manualCount ?? 5,
                  auto: p.manualAutoApprove ?? false,
                  color: 'text-blue-400',
                },
                {
                  label: 'Auto',
                  count: p.automaticCount ?? 5,
                  auto: p.automaticAutoApprove ?? false,
                  color: 'text-purple-400',
                },
              ].map(({ label, count, auto, color }) => (
                <div key={label} className="text-center bg-gray-950 rounded p-2">
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${color}`}>
                    {label}
                  </p>
                  <p className="text-sm font-bold">{count}</p>
                  <p className={`text-[10px] mt-0.5 ${auto ? 'text-green-400' : 'text-gray-600'}`}>
                    {auto ? '✓ Auto' : '✗ Manual'}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {p.autoApproveCompositions ? (
                <span className="text-[10px] text-red-400">✓ Auto-Publish Drafts</span>
              ) : (
                <span className="text-[10px] text-gray-600">✗ Manual Drafts Review</span>
              )}
              {p.engine_autoApproveIdeas ? (
                <span className="text-[10px] text-amber-400">✓ Engine: Auto-Compose Ideas</span>
              ) : (
                <span className="text-[10px] text-gray-600">✗ Engine: Manual Compose</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
