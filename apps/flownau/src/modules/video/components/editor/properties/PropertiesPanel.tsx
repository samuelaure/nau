'use client'

import React from 'react'
import { Settings, Maximize2, Type, Box } from 'lucide-react'
import { useEditorStore } from '@/modules/video/store/useEditorStore'
import { Tooltip } from '@/modules/video/components/ui/Tooltip'
import { toast } from 'sonner'
import {
  validateNumber,
  validateFrame,
  validateDimension,
  validatePosition,
} from '@/modules/video/utils/validation'

export function PropertiesPanel() {
  const template = useEditorStore((state) => state.template)
  const selectedElementId = useEditorStore((state) => state.selectedElementId)
  const updateElement = useEditorStore((state) => state.updateElement)
  const updateElementStyle = useEditorStore((state) => state.updateElementStyle)
  const updateTemplate = useEditorStore((state) => state.updateTemplate)

  const selectedElement = template.elements.find((el) => el.id === selectedElementId)

  // Font Loading Logic
  React.useEffect(() => {
    const fonts = new Set<string>()
    template.elements.forEach((el) => {
      if (el.type === 'text' && el.style.fontFamily) {
        fonts.add(el.style.fontFamily)
      }
    })

    if (fonts.size === 0) return

    const fontParams = Array.from(fonts)
      .map((font) => `family=${font.replace(/ /g, '+')}:wght@400;700`)
      .join('&')

    if (!fontParams) return

    const linkId = 'dynamic-google-fonts'
    let link = document.getElementById(linkId) as HTMLLinkElement

    if (!link) {
      link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }

    link.href = `https://fonts.googleapis.com/css2?${fontParams}&display=swap`
  }, [template.elements])

  const renderHeader = (icon: React.ReactNode, title: string) => (
    <div className="flex items-center gap-2 mb-4 px-1">
      <div className="text-accent">{icon}</div>
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">
        {title}
      </h3>
    </div>
  )

  const renderInputGroup = (
    label: string,
    value: string | number,
    onChange: (val: string) => void,
    type: 'text' | 'number' = 'text',
    step?: string,
    validator?: (val: string) => { isValid: boolean; error?: string },
    tooltip?: string,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value

      if (validator) {
        const { isValid, error } = validator(newVal)
        if (!isValid) {
          toast.error(error || 'Invalid input')
          return
        }
      }

      onChange(newVal)
    }

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center">
          <label className="text-[10px] font-semibold text-text-secondary/60 uppercase tracking-wider pl-1">
            {tooltip ? (
              <Tooltip content={tooltip} position="right" className="cursor-help">
                <span className="border-b border-dotted border-white/10 hover:border-accent/50 transition-colors">
                  {label}
                </span>
              </Tooltip>
            ) : (
              label
            )}
          </label>
        </div>
        <input
          type={type}
          step={step}
          value={value}
          onChange={handleChange}
          className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent focus:bg-accent/5 transition-all invalid:border-red-500 invalid:text-red-500"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-panel overflow-y-auto custom-scrollbar p-5">
      <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4">
        <Settings size={18} className="text-accent" />
        <h2 className="font-bold text-sm tracking-tight">Properties</h2>
      </div>

      {selectedElement ? (
        <div className="flex flex-col gap-8 animate-fade-in">
          {/* Element Identity */}
          <section>
            {renderHeader(<Box size={14} />, 'Identity')}
            <div className="flex flex-col gap-4 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              {renderInputGroup('Name', selectedElement.name, (val) =>
                updateElement(selectedElement.id, { name: val }),
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-text-secondary/60 uppercase tracking-wider pl-1">
                  {selectedElement.type === 'text' ? 'Content' : 'Source URL'}
                </label>
                {selectedElement.type === 'text' ? (
                  <textarea
                    value={selectedElement.content || ''}
                    onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent focus:bg-accent/5 transition-all min-h-[80px] resize-none"
                  />
                ) : (
                  <input
                    value={selectedElement.content || ''}
                    onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent focus:bg-accent/5 transition-all"
                    placeholder="https://..."
                  />
                )}
              </div>
            </div>
          </section>

          {/* Timeline Controls */}
          <section>
            {renderHeader(<Maximize2 size={14} />, 'Timing & Motion')}
            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {renderInputGroup(
                  'Start Frame',
                  selectedElement.startFrame,
                  (val) => updateElement(selectedElement.id, { startFrame: Number(val) }),
                  'number',
                  undefined,
                  (val) => validateFrame(val, template.durationInFrames),
                )}
                {renderInputGroup(
                  'Duration',
                  selectedElement.durationInFrames,
                  (val) => updateElement(selectedElement.id, { durationInFrames: Number(val) }),
                  'number',
                  undefined,
                  (val) => validateNumber(val, 1, template.durationInFrames),
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {renderInputGroup(
                  'Fade In',
                  selectedElement.fadeInDuration || 0,
                  (val) => updateElement(selectedElement.id, { fadeInDuration: Number(val) }),
                  'number',
                  undefined,
                  (val) => validateNumber(val, 0, selectedElement.durationInFrames / 2),
                )}
                {renderInputGroup(
                  'Fade Out',
                  selectedElement.fadeOutDuration || 0,
                  (val) => updateElement(selectedElement.id, { fadeOutDuration: Number(val) }),
                  'number',
                  undefined,
                  (val) => validateNumber(val, 0, selectedElement.durationInFrames / 2),
                )}
              </div>
            </div>
          </section>

          {/* Transform */}
          <section>
            {renderHeader(<Maximize2 size={14} />, 'Transform')}
            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {renderInputGroup(
                  'X Pos',
                  selectedElement.style.x,
                  (val) => updateElementStyle(selectedElement.id, { x: Number(val) }),
                  'number',
                  undefined,
                  (val) => validatePosition(val, template),
                )}
                {renderInputGroup(
                  'Y Pos',
                  selectedElement.style.y,
                  (val) => updateElementStyle(selectedElement.id, { y: Number(val) }),
                  'number',
                  undefined,
                  (val) => validatePosition(val, template),
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {renderInputGroup(
                  'Scale',
                  selectedElement.style.scale,
                  (val) => updateElementStyle(selectedElement.id, { scale: Number(val) }),
                  'number',
                  '0.1',
                  (val) => validateNumber(val, 0.1, 10),
                  'Zoom multiplier (0.1x - 10x)',
                )}
                {renderInputGroup(
                  'Rotation',
                  selectedElement.style.rotation,
                  (val) => updateElementStyle(selectedElement.id, { rotation: Number(val) }),
                  'number',
                  undefined,
                  (val) => validateNumber(val, -360, 360),
                )}
              </div>
            </div>
          </section>

          {/* Typography */}
          {selectedElement.type === 'text' && (
            <section>
              {renderHeader(<Type size={14} />, 'Typography')}
              <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 flex flex-col gap-4">
                {renderInputGroup(
                  'Font Size',
                  selectedElement.style.fontSize || 40,
                  (val) => updateElementStyle(selectedElement.id, { fontSize: Number(val) }),
                  'number',
                  undefined,
                  (val) => validateNumber(val, 1, 500),
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-text-secondary/60 uppercase tracking-wider pl-1">
                    Font Family
                  </label>
                  <select
                    value={selectedElement.style.fontFamily || 'Inter'}
                    onChange={(e) =>
                      updateElementStyle(selectedElement.id, { fontFamily: e.target.value })
                    }
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent focus:bg-accent/5 transition-all appearance-none"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 10px center',
                      backgroundSize: '12px',
                    }}
                  >
                    {[
                      'Inter',
                      'Outfit',
                      'Roboto',
                      'Lato',
                      'Montserrat',
                      'Oswald',
                      'Poppins',
                      'Playfair Display',
                    ].map((f) => (
                      <option key={f} value={f} className="bg-panel">
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {renderInputGroup('Color', selectedElement.style.color || '#ffffff', (val) =>
                  updateElementStyle(selectedElement.id, { color: val }),
                )}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8 animate-fade-in">
          <section>
            {renderHeader(<Settings size={14} />, 'Project Constraints')}
            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {renderInputGroup(
                  'Canvas W',
                  template.width,
                  (val) => updateTemplate({ width: Number(val) }),
                  'number',
                  undefined,
                  (val) => validateNumber(val, 100, 3840),
                )}
                {renderInputGroup(
                  'Canvas H',
                  template.height,
                  (val) => updateTemplate({ height: Number(val) }),
                  'number',
                  undefined,
                  (val) => validateNumber(val, 100, 3840),
                )}
              </div>
              {renderInputGroup(
                'Duration (Frames)',
                template.durationInFrames,
                (val) => updateTemplate({ durationInFrames: Number(val) }),
                'number',
                undefined,
                (val) => validateNumber(val, 30, 36000),
                'Total length in frames (30 = 1 sec)',
              )}
              {renderInputGroup(
                'Framerate (FPS)',
                template.fps,
                (val) => updateTemplate({ fps: Number(val) }),
                'number',
                undefined,
                (val) => validateNumber(val, 1, 120),
                'Playback speed',
              )}
            </div>
          </section>

          <div className="mt-4 p-4 rounded-2xl bg-accent/5 border border-accent/10">
            <p className="text-[11px] text-text-secondary leading-relaxed">
              <span className="text-accent font-bold">Pro Tip:</span> Select any layer from the list
              or canvas to unlock contextual properties and fine-tune your composition.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
