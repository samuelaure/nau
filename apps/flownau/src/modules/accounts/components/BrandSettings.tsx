'use client'

import { useTransition } from 'react'
import { updateBrand } from '@/modules/accounts/actions'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { Textarea } from '@/modules/shared/components/ui/Textarea'
import AccountPersonas from './AccountPersonas'
import AccountContentPrinciples from './AccountContentPrinciples'
import AccountPlanners from './AccountPlanners'
import AccountIdeasFrameworks from './AccountIdeasFrameworks'
import { useState } from 'react'
import { cn } from '@/modules/shared/utils'

type BrandSettingsTab = 'settings' | 'personas' | 'strategy' | 'principles' | 'planner'

const LANGUAGES = [
  { value: 'Spanish', label: 'Spanish' },
  { value: 'English', label: 'English' },
  { value: 'Italian', label: 'Italian' },
] as const

type Brand = {
  id: string
  language: string
  ideationCount: number
  directorPrompt: string | null
  creationPrompt: string | null
  shortCode: string | null
}

export default function BrandSettings({ brand }: { brand: Brand }) {
  const [tab, setTab] = useState<BrandSettingsTab>('settings')
  const [isPending, startTransition] = useTransition()

  const tabs: { id: BrandSettingsTab; label: string }[] = [
    { id: 'settings', label: 'Settings' },
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

      {tab === 'settings' && (
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

            <div className="w-full">
              <label className="form-label mb-1 block">
                Ideas per generation
                <span className="text-xs font-normal ml-2 opacity-70">
                  Default number of ideas generated per brainstorm session.
                </span>
              </label>
              <input
                type="number"
                name="ideationCount"
                min={1}
                max={30}
                defaultValue={brand.ideationCount}
                className="bg-gray-950 border border-border text-white rounded p-2.5 text-sm w-24"
              />
            </div>

            <div className="w-full border-t border-border pt-6">
              <label className="form-label mb-1 block">
                Director Prompt
                <span className="text-xs font-normal ml-2 opacity-70">
                  How the AI selects the best template for a given idea.
                </span>
              </label>
              <Textarea
                name="directorPrompt"
                defaultValue={brand.directorPrompt || ''}
                rows={5}
                className="bg-gray-950 border border-border text-white w-full rounded p-3 text-sm"
                placeholder="Explain how the AI should choose the best template for a given idea…"
              />
            </div>

            <div className="w-full">
              <label className="form-label mb-1 block">
                Creation Prompt
                <span className="text-xs font-normal ml-2 opacity-70">
                  Brand-specific instructions for template iteration and building.
                </span>
              </label>
              <Textarea
                name="creationPrompt"
                defaultValue={brand.creationPrompt || ''}
                rows={5}
                className="bg-gray-950 border border-border text-white w-full rounded p-3 text-sm"
                placeholder="Override the native structural rules with brand-specific iteration logic…"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === 'personas' && <AccountPersonas brandId={brand.id} />}
      {tab === 'strategy' && <AccountIdeasFrameworks brandId={brand.id} />}
      {tab === 'principles' && <AccountContentPrinciples brandId={brand.id} />}
      {tab === 'planner' && <AccountPlanners brandId={brand.id} />}
    </div>
  )
}
