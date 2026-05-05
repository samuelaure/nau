'use client'

import { useState } from 'react'

type AdminModelFeature = 'ideation' | 'drafting' | 'planning'
const ADMIN_MODEL_SETTING_KEYS: Record<AdminModelFeature, string> = {
  ideation: 'model_ideation',
  drafting: 'model_drafting',
  planning: 'model_planning',
}

const MODEL_OPTIONS: { value: string; label: string; note?: string }[] = [
  { value: '', label: 'Platform default' },
  { value: 'GROQ_LLAMA_3_3',       label: 'Groq — Llama 3.3 70B',    note: 'Fast · cheap' },
  { value: 'GROQ_LLAMA_3_1_70B',   label: 'Groq — Llama 3.1 70B' },
  { value: 'GROQ_LLAMA_3_1_8B',    label: 'Groq — Llama 3.1 8B',     note: 'Fastest · cheapest' },
  { value: 'GROQ_DEEPSEEK_R1_70B', label: 'Groq — DeepSeek R1 70B',  note: 'Reasoning' },
  { value: 'OPENAI_GPT_4O_MINI',   label: 'OpenAI — GPT-4o Mini',    note: '$0.15 / 1M' },
  { value: 'OPENAI_GPT_4O',        label: 'OpenAI — GPT-4o',         note: '$5 / 1M' },
  { value: 'OPENAI_GPT_4_1',       label: 'OpenAI — GPT-4.1',        note: '$10 / 1M' },
  { value: 'OPENAI_GPT_4_TURBO',   label: 'OpenAI — GPT-4 Turbo',    note: '$10 / 1M' },
]

const FEATURES: { key: AdminModelFeature; label: string; description: string }[] = [
  { key: 'ideation',  label: 'Ideation',  description: 'Content idea generation — topic → concept ideas with angles.' },
  { key: 'drafting',  label: 'Drafting',  description: 'Script / creative draft generation — idea → video script + caption.' },
  { key: 'planning',  label: 'Planning',  description: 'Calendar strategist — orders approved content by posting priority.' },
]

interface Props {
  initialSettings: Record<string, string>
}

export default function AdminSettingsClient({ initialSettings }: Props) {
  const [values, setValues] = useState<Record<string, string>>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const body: Record<string, string> = {}
    for (const feature of FEATURES) {
      body[ADMIN_MODEL_SETTING_KEYS[feature.key]] = values[ADMIN_MODEL_SETTING_KEYS[feature.key]] ?? ''
    }
    await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-white">Admin Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">Platform-wide model configuration. Changes apply immediately to all users.</p>
      </div>

      <div className="space-y-1">
        <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">AI Models</h2>
        <p className="text-xs text-zinc-500 mb-4">Overrides the default model per pipeline stage. "Platform default" uses the built-in feature mapping.</p>

        <div className="space-y-4">
          {FEATURES.map(({ key, label, description }) => {
            const settingKey = ADMIN_MODEL_SETTING_KEYS[key]
            const current = values[settingKey] ?? ''
            return (
              <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
                  </div>
                  <select
                    value={current}
                    onChange={(e) => setValues((v) => ({ ...v, [settingKey]: e.target.value }))}
                    className="shrink-0 text-sm bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-1.5 focus:outline-none focus:border-zinc-500"
                  >
                    {MODEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}{opt.note ? ` · ${opt.note}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-white text-black rounded hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved</span>}
      </div>
    </div>
  )
}
