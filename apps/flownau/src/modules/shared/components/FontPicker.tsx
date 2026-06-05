'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/modules/shared/utils'

export const FONT_OPTIONS: Array<{ value: string; description: string }> = [
  { description: 'bold display', value: 'Anton' },
  { description: 'condensed impact', value: 'Bebas Neue' },
  { description: 'condensed editorial', value: 'Oswald' },
  { description: 'heavy, asian-friendly', value: 'Black Han Sans' },
  { description: 'condensed sport', value: 'Barlow Condensed' },
  { description: 'tall bold display', value: 'Teko' },
  { description: 'retro bold', value: 'Righteous' },
  { description: 'heavy grotesque', value: 'Archivo Black' },
  { description: 'clean neutral', value: 'Inter' },
  { description: 'geometric bold', value: 'Montserrat' },
  { description: 'rounded modern', value: 'Poppins' },
  { description: 'low-contrast readable', value: 'DM Sans' },
  { description: 'soft rounded', value: 'Nunito' },
  { description: 'elegant thin', value: 'Raleway' },
  { description: 'humanist balanced', value: 'Lato' },
  { description: 'universal readable', value: 'Roboto' },
  { description: 'open grotesque', value: 'Work Sans' },
  { description: 'wide modern', value: 'Manrope' },
  { description: 'minimalist clean', value: 'Urbanist' },
  { description: 'contemporary geometric', value: 'Outfit' },
  { description: 'friendly modern', value: 'Figtree' },
  { description: 'tech editorial', value: 'Space Grotesk' },
  { description: 'clean circular', value: 'Sora' },
  { description: 'condensed versatile', value: 'Barlow' },
  { description: 'sharp modern', value: 'Kanit' },
  { description: 'editorial serif', value: 'Playfair Display' },
  { description: 'warm readable serif', value: 'Lora' },
  { description: 'sturdy news serif', value: 'Merriweather' },
  { description: 'elegant high contrast', value: 'Cormorant' },
  { description: 'classic book serif', value: 'Libre Baskerville' },
  { description: 'vintage editorial', value: 'Crimson Text' },
  { description: 'roman decorative', value: 'Cinzel' },
  { description: 'flowing script', value: 'Dancing Script' },
  { description: 'thin signature', value: 'Sacramento' },
  { description: 'casual script', value: 'Satisfy' },
  { description: 'playful retro', value: 'Pacifico' },
  { description: 'natural handwritten', value: 'Caveat' },
]

export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  'family=Anton&family=Bebas+Neue&family=Oswald:wght@700&family=Black+Han+Sans&' +
  'family=Barlow+Condensed:wght@700&family=Teko:wght@600&' +
  'family=Righteous&family=Archivo+Black&' +
  'family=Inter:wght@700&family=Montserrat:wght@700&family=Poppins:wght@700&' +
  'family=DM+Sans:wght@700&family=Nunito:wght@700&family=Raleway:wght@700&' +
  'family=Lato:wght@700&family=Roboto:wght@700&family=Work+Sans:wght@700&' +
  'family=Manrope:wght@700&family=Urbanist:wght@700&family=Outfit:wght@700&' +
  'family=Figtree:wght@700&family=Space+Grotesk:wght@700&family=Sora:wght@700&' +
  'family=Barlow:wght@700&family=Kanit:wght@700&' +
  'family=Playfair+Display:wght@700&family=Lora:wght@700&family=Merriweather:wght@700&' +
  'family=Cormorant:wght@700&family=Libre+Baskerville:wght@700&family=Crimson+Text:wght@700&' +
  'family=Cinzel:wght@700&' +
  'family=Dancing+Script:wght@700&family=Sacramento&family=Satisfy&family=Pacifico&family=Caveat:wght@700&' +
  'display=swap'

// Overloaded props: form mode vs controlled mode
export type FontPickerProps =
  | { name: string; defaultValue: string; value?: never; onChange?: never; allowBrandDefault?: never }
  | { name?: never; defaultValue?: never; value: string | null; onChange: (font: string | null) => void; allowBrandDefault?: boolean }

function loadFonts() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`link[href="${GOOGLE_FONTS_URL}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = GOOGLE_FONTS_URL
  document.head.appendChild(link)
}

export function FontPicker(props: FontPickerProps) {
  const isControlled = 'onChange' in props && props.onChange !== undefined

  const [internalValue, setInternalValue] = useState<string>(
    isControlled ? (props.value ?? '') : (props as any).defaultValue,
  )
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(loadFonts, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentValue = isControlled ? ((props as any).value as string | null) : internalValue

  const isNull = currentValue === null || currentValue === ''
  const selectedFont = isNull ? null : FONT_OPTIONS.find((f) => f.value === currentValue)
  const triggerLabel = isNull ? '— Brand default —' : currentValue ?? '— Brand default —'
  const triggerDescription = isNull ? 'use brand value' : selectedFont?.description ?? ''

  function selectValue(v: string | null) {
    if (isControlled) {
      ;(props as any).onChange(v)
    } else {
      setInternalValue(v ?? 'sans-serif')
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative w-full">
      {!isControlled && (
        <input type="hidden" name={(props as any).name} value={internalValue} />
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 bg-gray-950 border border-border rounded p-2 text-sm text-white hover:border-white/30 transition-colors"
      >
        <span
          style={{ fontFamily: currentValue ?? 'inherit', fontSize: 15 }}
          className={cn(isNull && 'italic text-gray-500')}
        >
          {triggerLabel}
        </span>
        <span className="text-xs text-text-secondary shrink-0 ml-1">{triggerDescription}</span>
        <svg className="w-3.5 h-3.5 text-text-secondary shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-gray-900 border border-border rounded shadow-xl overflow-y-auto max-h-72">
          {isControlled && (props as any).allowBrandDefault && (
            <button
              type="button"
              onClick={() => selectValue(null)}
              className={cn('w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-gray-800', isNull && 'bg-white/10')}
            >
              <span className="text-gray-400 italic text-sm">— Brand default —</span>
              <span className="text-xs text-text-secondary shrink-0">use brand value</span>
            </button>
          )}
          {!isControlled && (
            <button
              type="button"
              onClick={() => selectValue('sans-serif')}
              className={cn('w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-gray-800', currentValue === 'sans-serif' && 'bg-white/10')}
            >
              <span className="text-gray-400 italic text-sm">— System default —</span>
              <span className="text-xs text-text-secondary shrink-0">system default</span>
            </button>
          )}
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => selectValue(f.value)}
              className={cn('w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left', currentValue === f.value && 'bg-white/10')}
            >
              <span style={{ fontFamily: f.value, fontSize: 16, lineHeight: 1 }} className="text-white">{f.value}</span>
              <span className="text-xs text-text-secondary shrink-0">{f.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}