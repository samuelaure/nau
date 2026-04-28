'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PostSchedule {
  formatChain: string[]
  dailyFrequency: number
  windowStart: string
  windowEnd: string
  timezone: string
  isActive: boolean
}

interface AccountScheduleProps {
  brandId: string
  initialSchedule: PostSchedule | null
}

// ── Available formats ─────────────────────────────────────────────────────────

const FORMATS = [
  { id: 'reel', label: 'Reel' },
  { id: 'head_talk', label: 'Head Talk' },
  { id: 'carousel', label: 'Carousel' },
] as const

type FormatId = (typeof FORMATS)[number]['id']

// ── Chain builder: amounts per format → randomized chain ──────────────────────

function buildChain(amounts: Record<string, number>): string[] {
  const pool: string[] = []
  for (const [fmt, count] of Object.entries(amounts)) {
    for (let i = 0; i < count; i++) pool.push(fmt)
  }
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

function countFormats(chain: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const f of chain) counts[f] = (counts[f] ?? 0) + 1
  return counts
}

// ── Common timezones ──────────────────────────────────────────────────────────

const TIMEZONES = [
  'UTC',
  'Europe/Madrid',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountSchedule({ brandId, initialSchedule }: AccountScheduleProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Schedule fields
  const [isActive, setIsActive] = useState(initialSchedule?.isActive ?? true)
  const [dailyFrequency, setDailyFrequency] = useState(initialSchedule?.dailyFrequency ?? 1)
  const [windowStart, setWindowStart] = useState(initialSchedule?.windowStart ?? '09:00')
  const [windowEnd, setWindowEnd] = useState(initialSchedule?.windowEnd ?? '21:00')
  const [timezone, setTimezone] = useState(initialSchedule?.timezone ?? 'UTC')

  // Format chain
  const [chain, setChain] = useState<string[]>(initialSchedule?.formatChain ?? [])
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    initialSchedule ? countFormats(initialSchedule.formatChain) : {},
  )

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleAmountChange = useCallback((fmt: string, value: number) => {
    setAmounts((prev) => ({ ...prev, [fmt]: Math.max(0, value) }))
  }, [])

  const handleShuffle = useCallback(() => {
    setChain(buildChain(amounts))
  }, [amounts])

  // Auto-shuffle when amounts change if chain is empty
  useEffect(() => {
    if (chain.length === 0) {
      const total = Object.values(amounts).reduce((s, n) => s + n, 0)
      if (total > 0) setChain(buildChain(amounts))
    }
  }, [amounts, chain.length])

  // ── Drag and drop ────────────────────────────────────────────────────────────

  const handleDragStart = (i: number) => setDragIndex(i)
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    setDragOverIndex(i)
  }
  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return
    const next = [...chain]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, moved)
    setChain(next)
    setDragIndex(null)
    setDragOverIndex(null)
  }
  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const removeFromChain = (i: number) => {
    setChain((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (chain.length === 0) {
      setError('Format chain cannot be empty.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/brands/${brandId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formatChain: chain, dailyFrequency, windowStart, windowEnd, timezone, isActive }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Format label helpers ──────────────────────────────────────────────────────

  const formatLabel = (f: string) => FORMATS.find((fmt) => fmt.id === f)?.label ?? f
  const formatColor: Record<string, string> = {
    reel: 'bg-accent/20 text-accent border-accent/30',
    head_talk: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    carousel: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Active toggle */}
      <Card className="p-6 flex items-center justify-between">
        <div>
          <p className="font-medium text-white">Posting Schedule</p>
          <p className="text-sm text-text-secondary mt-0.5">Enable to auto-fill your content calendar</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
        </label>
      </Card>

      {/* Posting rhythm */}
      <Card className="p-6 flex flex-col gap-5">
        <h3 className="font-semibold text-white">Posting Rhythm</h3>

        <div className="flex gap-6 flex-wrap">
          <div>
            <label className="form-label block mb-1">Posts per day</label>
            <input
              type="number"
              min={1}
              max={10}
              value={dailyFrequency}
              onChange={(e) => setDailyFrequency(Number(e.target.value))}
              className="bg-gray-950 border border-border text-white rounded p-2.5 text-sm w-20"
            />
          </div>
          <div>
            <label className="form-label block mb-1">Window start</label>
            <input
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              className="bg-gray-950 border border-border text-white rounded p-2.5 text-sm"
            />
          </div>
          <div>
            <label className="form-label block mb-1">Window end</label>
            <input
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="bg-gray-950 border border-border text-white rounded p-2.5 text-sm"
            />
          </div>
          <div>
            <label className="form-label block mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="bg-gray-950 border border-border text-white rounded p-2.5 text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Format chain builder */}
      <Card className="p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Format Chain</h3>
          <button
            onClick={handleShuffle}
            className="text-xs text-accent hover:text-accent/80 transition-colors border border-accent/30 rounded px-3 py-1"
          >
            Shuffle
          </button>
        </div>
        <p className="text-sm text-text-secondary -mt-3">
          Set how many of each format you want per cycle, then shuffle or drag to reorder.
        </p>

        {/* Amounts per format */}
        <div className="flex flex-wrap gap-4">
          {FORMATS.map(({ id, label }) => (
            <div key={id} className="flex flex-col gap-1.5">
              <label className="text-xs text-text-secondary">{label}</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAmountChange(id, (amounts[id] ?? 0) - 1)}
                  className="w-7 h-7 rounded border border-border text-text-secondary hover:text-white flex items-center justify-center text-lg leading-none"
                >
                  −
                </button>
                <span className="text-white font-mono w-5 text-center">{amounts[id] ?? 0}</span>
                <button
                  onClick={() => handleAmountChange(id, (amounts[id] ?? 0) + 1)}
                  className="w-7 h-7 rounded border border-border text-text-secondary hover:text-white flex items-center justify-center text-lg leading-none"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Chain preview — drag & drop */}
        {chain.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-text-secondary">Drag to reorder · Click × to remove</p>
            <div className="flex flex-col gap-1.5">
              {chain.map((fmt, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  className={[
                    'flex items-center gap-3 px-3 py-2 rounded border cursor-grab active:cursor-grabbing transition-all select-none',
                    formatColor[fmt] ?? 'bg-white/5 text-white border-white/10',
                    dragOverIndex === i && dragIndex !== i ? 'opacity-50 scale-95' : '',
                  ].join(' ')}
                >
                  <span className="text-xs opacity-40 w-5 text-right">{i + 1}</span>
                  <span className="flex-1 text-sm font-medium">{formatLabel(fmt)}</span>
                  <button
                    onClick={() => removeFromChain(i)}
                    className="opacity-40 hover:opacity-100 transition-opacity text-sm leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary italic">
            Add formats above and hit Shuffle to generate a chain.
          </p>
        )}
      </Card>

      {/* Save */}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button onClick={handleSave} disabled={saving} className="self-start">
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Schedule'}
      </Button>
    </div>
  )
}
