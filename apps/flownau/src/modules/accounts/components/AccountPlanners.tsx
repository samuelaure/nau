'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { Input } from '@/modules/shared/components/ui/Input'
import { Textarea } from '@/modules/shared/components/ui/Textarea'
import { toast } from 'sonner'

const DEFAULT_FORM = {
  name: '',
  isDefault: false,
  autoApproveSchedule: false,
  strategistPrompt: '',
  daysToPlan: 7,
  reelsPerDay: 5,
  trialReelsPerDay: 5,
  postingTimes: [] as string[],
  trialPostingTimes: [] as string[],
  timezone: 'Europe/Madrid',
  frequencyDays: 1,
}

function TimeSlotList({
  label,
  times,
  onChange,
}: {
  label: string
  times: string[]
  onChange: (times: string[]) => void
}) {
  const add = () => onChange([...times, '09:00'])
  const remove = (i: number) => onChange(times.filter((_, idx) => idx !== i))
  const update = (i: number, val: string) => onChange(times.map((t, idx) => (idx === i ? val : t)))

  return (
    <div>
      <label className="form-label mb-2 block">{label}</label>
      <div className="space-y-2">
        {times.map((t, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="time"
              value={t}
              onChange={(e) => update(i, e.target.value)}
              className="input-field w-32"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={add} className="text-accent text-xs hover:underline">
          + Add time slot
        </button>
      </div>
    </div>
  )
}

export default function AccountPlanners({ accountId }: { accountId: string }) {
  const [planners, setPlanners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ ...DEFAULT_FORM })

  const fetchPlanners = async () => {
    try {
      const res = await fetch(`/api/planners?accountId=${accountId}`)
      const data = await res.json()
      setPlanners(data.planners || [])
    } catch {
      toast.error('Failed to load planners')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlanners()
  }, [accountId])

  const f = (key: keyof typeof formData, val: any) =>
    setFormData((prev) => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    if (!formData.name) return toast.error('Name is required')
    try {
      if (editingId && editingId !== 'new') {
        const res = await fetch(`/api/planners/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, ...formData }),
        })
        if (!res.ok) throw new Error()
        toast.success('Planner updated')
      } else {
        const res = await fetch('/api/planners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, ...formData }),
        })
        if (!res.ok) throw new Error()
        toast.success('Planner created')
      }
      setEditingId(null)
      setFormData({ ...DEFAULT_FORM })
      fetchPlanners()
    } catch {
      toast.error('Failed to save planner')
    }
  }

  const handleEdit = (p: any) => {
    setEditingId(p.id)
    setFormData({
      name: p.name,
      isDefault: p.isDefault,
      autoApproveSchedule: p.autoApproveSchedule,
      strategistPrompt: p.strategistPrompt ?? '',
      daysToPlan: p.daysToPlan ?? 7,
      reelsPerDay: p.reelsPerDay,
      trialReelsPerDay: p.trialReelsPerDay,
      postingTimes: Array.isArray(p.postingTimes) ? p.postingTimes : [],
      trialPostingTimes: Array.isArray(p.trialPostingTimes) ? p.trialPostingTimes : [],
      timezone: p.timezone,
      frequencyDays: p.frequencyDays,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this planner?')) return
    try {
      await fetch(`/api/planners/${id}`, { method: 'DELETE' })
      toast.success('Deleted')
      fetchPlanners()
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (loading) return <p className="text-text-secondary text-sm">Loading...</p>

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-heading font-semibold">Content Planners</h2>
          <p className="text-text-secondary text-sm mt-1">
            Posting schedules and AI scheduling strategy. The default planner drives autonomous
            scheduling.
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
            + Add Planner
          </Button>
        )}
      </div>

      {editingId && (
        <Card className="p-6 space-y-5">
          <h3 className="font-semibold">{editingId === 'new' ? 'New Planner' : 'Edit Planner'}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name" value={formData.name} onChange={(e) => f('name', e.target.value)} />
            <Input
              label="Timezone"
              value={formData.timezone}
              onChange={(e) => f('timezone', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input
              label="Reels/day"
              type="number"
              min={0}
              value={formData.reelsPerDay}
              onChange={(e) => f('reelsPerDay', Number(e.target.value))}
            />
            <Input
              label="Trial reels/day"
              type="number"
              min={0}
              value={formData.trialReelsPerDay}
              onChange={(e) => f('trialReelsPerDay', Number(e.target.value))}
            />
            <Input
              label="Days to plan"
              type="number"
              min={1}
              value={formData.daysToPlan}
              onChange={(e) => f('daysToPlan', Number(e.target.value))}
            />
            <Input
              label="Frequency (every N days)"
              type="number"
              min={1}
              value={formData.frequencyDays}
              onChange={(e) => f('frequencyDays', Number(e.target.value))}
            />
          </div>

          <TimeSlotList
            label="Reel posting times (HH:MM)"
            times={formData.postingTimes}
            onChange={(v) => f('postingTimes', v)}
          />
          <TimeSlotList
            label="Trial reel posting times (HH:MM)"
            times={formData.trialPostingTimes}
            onChange={(v) => f('trialPostingTimes', v)}
          />

          <div>
            <label className="form-label mb-1 block">
              AI Strategist Prompt
              <span className="text-xs font-normal ml-2 opacity-70">
                Guides AI ordering (e.g. "prioritise educational before promotional")
              </span>
            </label>
            <Textarea
              value={formData.strategistPrompt}
              onChange={(e) => f('strategistPrompt', e.target.value)}
              rows={5}
              className="bg-gray-950 border border-border text-white w-full rounded p-3 text-sm"
              placeholder="Prioritise educational content on weekdays, promotional on weekends. Avoid posting similar formats back-to-back..."
            />
          </div>

          <div className="flex flex-wrap gap-4">
            {[
              { key: 'isDefault', label: 'Set as default planner' },
              { key: 'autoApproveSchedule', label: 'Auto-approve schedule (APPROVED → SCHEDULED)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData[key as keyof typeof formData] as boolean}
                  onChange={(e) => f(key as keyof typeof formData, e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

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
        {planners.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.isDefault && (
                    <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-[11px]">
                  <span className="text-gray-400">
                    {p.reelsPerDay} reels/day · {p.trialReelsPerDay} trial/day · {p.timezone}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {p.autoApproveSchedule ? (
                    <span className="text-[10px] text-green-400">✓ Auto-schedule</span>
                  ) : (
                    <span className="text-[10px] text-gray-600">✗ Manual schedule</span>
                  )}
                  {p.strategistPrompt && (
                    <span className="text-[10px] text-blue-400">✓ AI Strategist</span>
                  )}
                </div>
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
        {planners.length === 0 && !editingId && (
          <p className="text-text-secondary text-sm">
            No planners yet. Create a content planner to control posting schedule and AI strategy.
          </p>
        )}
      </div>
    </div>
  )
}
