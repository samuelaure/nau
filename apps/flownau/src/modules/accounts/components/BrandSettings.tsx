'use client'

import { useTransition } from 'react'
import { updateBrand, updateOwnedSynthesis } from '@/modules/accounts/actions'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import AccountPersonas from './AccountPersonas'
import AccountContentPrinciples from './AccountContentPrinciples'
import AccountPlanners from './AccountPlanners'
import AccountIdeasFrameworks from './AccountIdeasFrameworks'
import AccountSchedule from './AccountSchedule'
import { useState } from 'react'
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
  { label: '— System default —', value: 'sans-serif' },
  // Impact / display
  { label: 'Anton (bold display)', value: 'Anton' },
  { label: 'Bebas Neue (condensed impact)', value: 'Bebas Neue' },
  { label: 'Oswald (condensed editorial)', value: 'Oswald' },
  { label: 'Black Han Sans (heavy asian-friendly)', value: 'Black Han Sans' },
  // Modern sans-serif
  { label: 'Inter (clean neutral)', value: 'Inter' },
  { label: 'Montserrat (geometric bold)', value: 'Montserrat' },
  { label: 'Poppins (rounded modern)', value: 'Poppins' },
  { label: 'DM Sans (low-contrast readable)', value: 'DM Sans' },
  { label: 'Nunito (soft rounded)', value: 'Nunito' },
  { label: 'Raleway (elegant thin)', value: 'Raleway' },
  // Serif / editorial
  { label: 'Playfair Display (editorial serif)', value: 'Playfair Display' },
] as const

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
                  <select
                    name="bi_titleFont"
                    defaultValue={brand.brandIdentity?.titleFont ?? 'sans-serif'}
                    className="bg-gray-950 border border-border text-white rounded p-2 text-sm w-full"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label mb-1 block text-xs">Body Font</label>
                  <select
                    name="bi_bodyFont"
                    defaultValue={brand.brandIdentity?.bodyFont ?? 'sans-serif'}
                    className="bg-gray-950 border border-border text-white rounded p-2 text-sm w-full"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
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
