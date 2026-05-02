'use client'

import { useTransition, useEffect, useRef, useState } from 'react'
import { updateBrand, updateOwnedSynthesis } from '@/modules/accounts/actions'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import AccountPersonas from './AccountPersonas'
import AccountContentPrinciples from './AccountContentPrinciples'
import AccountPlanners from './AccountPlanners'
import AccountIdeasFrameworks from './AccountIdeasFrameworks'
import AccountSchedule from './AccountSchedule'
import { cn } from '@/modules/shared/utils'

type BrandSettingsTab = 'general' | 'personas' | 'strategy' | 'principles' | 'planner' | 'schedule'

interface PostSchedule {
  formatChain: string[]
  dailyFrequency: number
  windowStart: string
  windowEnd: string
  timezone: string
  isActive: boolean
}

const LANGUAGES = [
  { value: 'Spanish', label: 'Spanish' },
  { value: 'English', label: 'English' },
  { value: 'Italian', label: 'Italian' },
] as const

interface BrandIdentity {
  primaryColor?: string
  secondaryColor?: string
  titleFont?: string
  bodyFont?: string
  overlayOpacity?: number
  logoUrl?: string
  maxTextSize?: number
}

const FONT_OPTIONS = [
  { description: 'System default',           value: 'sans-serif'       },
  { description: 'bold display',             value: 'Anton'            },
  { description: 'condensed impact',         value: 'Bebas Neue'       },
  { description: 'condensed editorial',      value: 'Oswald'           },
  { description: 'heavy, asian-friendly',    value: 'Black Han Sans'   },
  { description: 'clean neutral',            value: 'Inter'            },
  { description: 'geometric bold',           value: 'Montserrat'       },
  { description: 'rounded modern',           value: 'Poppins'          },
  { description: 'low-contrast readable',    value: 'DM Sans'          },
  { description: 'soft rounded',             value: 'Nunito'           },
  { description: 'elegant thin',             value: 'Raleway'          },
  { description: 'editorial serif',          value: 'Playfair Display' },
]

// Google Fonts URL for all custom fonts in the list
const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Oswald:wght@700&family=Black+Han+Sans&family=Inter:wght@700&family=Montserrat:wght@700&family=Poppins:wght@700&family=DM+Sans:wght@700&family=Nunito:wght@700&family=Raleway:wght@700&family=Playfair+Display:wght@700&display=swap'

function FontPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Load Google Fonts once
  useEffect(() => {
    if (document.querySelector(`link[href="${GOOGLE_FONTS_URL}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = GOOGLE_FONTS_URL
    document.head.appendChild(link)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = FONT_OPTIONS.find((f) => f.value === value) ?? FONT_OPTIONS[0]!

  return (
    <div ref={ref} className="relative w-full">
      {/* Hidden input so the form picks up the value */}
      <input type="hidden" name={name} value={value} />

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 bg-gray-950 border border-border rounded p-2 text-sm text-white hover:border-white/30 transition-colors"
      >
        <span style={{ fontFamily: selected.value, fontSize: 15 }}>
          {selected.value === 'sans-serif' ? '— System default —' : selected.value}
        </span>
        <span className="text-xs text-text-secondary shrink-0 ml-1">{selected.description}</span>
        <svg className="w-3.5 h-3.5 text-text-secondary shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-gray-900 border border-border rounded shadow-xl overflow-y-auto max-h-72">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => { setValue(f.value); setOpen(false) }}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left',
                value === f.value && 'bg-white/10',
              )}
            >
              <span
                style={{ fontFamily: f.value, fontSize: 16, lineHeight: 1 }}
                className="text-white"
              >
                {f.value === 'sans-serif' ? '— System default —' : f.value}
              </span>
              <span className="text-xs text-text-secondary shrink-0">{f.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Brand = {
  id: string
  language: string
  ideationCount: number
  autoApproveIdeas: boolean
  shortCode: string | null
  coverageHorizonDays: number
  brandIdentity?: BrandIdentity | null
}

export default function BrandSettings({ brand, initialSchedule, initialTab }: { brand: Brand; initialSchedule: PostSchedule | null; initialTab?: BrandSettingsTab }) {
  const [tab, setTab] = useState<BrandSettingsTab>(initialTab ?? 'general')
  const [isPending, startTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)

  const tabs: { id: BrandSettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'personas', label: 'Personas' },
    { id: 'strategy', label: 'Strategy' },
    { id: 'principles', label: 'Principles' },
    { id: 'planner', label: 'Planner' },
  ]

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      await updateBrand(brand.id, formData)
    })
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex border-b border-white/5 gap-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-5 py-2.5 -mb-px text-sm border-b-2 transition-all whitespace-nowrap',
              tab === t.id
                ? 'text-accent border-accent font-semibold'
                : 'text-text-secondary border-transparent hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <Card className="p-8 max-w-2xl">
          <h3 className="text-xl font-heading font-semibold mb-6">Brand Pipeline Config</h3>
          <form action={handleUpdate} className="flex flex-col gap-6">
            <div className="w-full">
              <label className="form-label mb-1 block">
                Content Language
                <span className="text-xs font-normal ml-2 opacity-70">
                  All AI-generated content will be written in this language.
                </span>
              </label>
              <select
                name="language"
                defaultValue={brand.language}
                className="bg-gray-950 border border-border text-white rounded p-2.5 text-sm w-48"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full border-t border-white/5 pt-6 flex flex-col gap-4">
              <h4 className="form-label font-semibold text-white">Brand Identity</h4>
              <p className="text-xs text-text-secondary -mt-2">Colors and fonts used in Remotion video templates.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label mb-1 block text-xs">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue={brand.brandIdentity?.primaryColor ?? '#000000'}
                      className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      name="bi_primaryColor"
                      defaultValue={brand.brandIdentity?.primaryColor ?? '#000000'}
                      placeholder="#000000"
                      className="bg-gray-950 border border-border text-white rounded p-2 text-sm flex-1 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label mb-1 block text-xs">Secondary Color (text)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue={brand.brandIdentity?.secondaryColor ?? '#ffffff'}
                      className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      name="bi_secondaryColor"
                      defaultValue={brand.brandIdentity?.secondaryColor ?? '#ffffff'}
                      placeholder="#ffffff"
                      className="bg-gray-950 border border-border text-white rounded p-2 text-sm flex-1 font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label mb-1 block text-xs">Title Font</label>
                  <FontPicker name="bi_titleFont" defaultValue={brand.brandIdentity?.titleFont ?? 'sans-serif'} />
                </div>
                <div>
                  <label className="form-label mb-1 block text-xs">Body Font</label>
                  <FontPicker name="bi_bodyFont" defaultValue={brand.brandIdentity?.bodyFont ?? 'sans-serif'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label mb-1 block text-xs">
                    Overlay Opacity
                    <span className="ml-1 opacity-60">(0 = transparent, 1 = solid)</span>
                  </label>
                  <input
                    type="number"
                    name="bi_overlayOpacity"
                    defaultValue={brand.brandIdentity?.overlayOpacity ?? 0.55}
                    min="0"
                    max="1"
                    step="0.05"
                    className="bg-gray-950 border border-border text-white rounded p-2 text-sm w-full"
                  />
                </div>
                <div>
                  <label className="form-label mb-1 block text-xs">
                    Max Text Size
                    <span className="ml-1 opacity-60">(% of template default)</span>
                  </label>
                  <input
                    type="number"
                    name="bi_maxTextSize"
                    defaultValue={brand.brandIdentity?.maxTextSize ?? 100}
                    min="50"
                    max="150"
                    step="5"
                    className="bg-gray-950 border border-border text-white rounded p-2 text-sm w-full"
                  />
                </div>
              </div>
            </div>

            <div className="w-full border-t border-white/5 pt-6 flex flex-col gap-3">
              <label className="form-label block">
                Owned Content Synthesis fallback
                <span className="text-xs font-normal ml-2 opacity-70">
                  Manually trigger (re)generation of content topics & brand voice from owned posts.
                </span>
              </label>
              <div className="flex">
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={isGenerating}
                  onClick={async () => {
                    setIsGenerating(true)
                    try {
                      await updateOwnedSynthesis(brand.id)
                      alert('Synthesis updated successfully!')
                    } catch (err: any) {
                      alert(`Error: ${err.message}`)
                    } finally {
                      setIsGenerating(false)
                    }
                  }}
                >
                  {isGenerating ? 'Generating…' : 'Update Synthesis'}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/5">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === 'schedule' && <AccountSchedule brandId={brand.id} initialSchedule={initialSchedule} initialIdeationCount={brand.ideationCount} initialAutoApproveIdeas={brand.autoApproveIdeas} initialCoverageHorizonDays={brand.coverageHorizonDays} />}
      {tab === 'personas' && <AccountPersonas brandId={brand.id} />}
      {tab === 'strategy' && <AccountIdeasFrameworks brandId={brand.id} />}
      {tab === 'principles' && <AccountContentPrinciples brandId={brand.id} />}
      {tab === 'planner' && <AccountPlanners brandId={brand.id} />}
    </div>
  )
}
