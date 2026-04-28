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

type Brand = {
  id: string
  language: string
  ideationCount: number
  autoApproveIdeas: boolean
  shortCode: string | null
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

      {tab === 'schedule' && <AccountSchedule brandId={brand.id} initialSchedule={initialSchedule} initialIdeationCount={brand.ideationCount} initialAutoApproveIdeas={brand.autoApproveIdeas} />}
      {tab === 'personas' && <AccountPersonas brandId={brand.id} />}
      {tab === 'strategy' && <AccountIdeasFrameworks brandId={brand.id} />}
      {tab === 'principles' && <AccountContentPrinciples brandId={brand.id} />}
      {tab === 'planner' && <AccountPlanners brandId={brand.id} />}
    </div>
  )
}
