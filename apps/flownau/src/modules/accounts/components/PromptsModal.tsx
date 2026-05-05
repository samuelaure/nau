'use client'

import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { cn } from '@/modules/shared/utils'

interface TraceEntry {
  provider?: string
  model?: string
  registryId?: string
  generatedAt?: string
  systemPrompt?: string
  userMessage?: string
}

interface LlmTrace {
  ideaTrace?: TraceEntry
  draftTrace?: TraceEntry
  [key: string]: TraceEntry | undefined
}

const TRACE_LABELS: Record<string, string> = {
  ideaTrace:  'Ideation',
  draftTrace: 'Draft Composition',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition-colors shrink-0">
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function TraceSection({ label, trace }: { label: string; trace: TraceEntry }) {
  const [sysOpen, setSysOpen] = useState(false)
  const [msgOpen, setMsgOpen] = useState(false)

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-white/3 flex items-center gap-3">
        <span className="text-xs font-bold text-white/80 uppercase tracking-widest">{label}</span>
        {trace.model && (
          <span className="text-[10px] text-gray-500 font-mono">{trace.registryId ?? trace.model}</span>
        )}
        {trace.generatedAt && (
          <span className="text-[10px] text-gray-600 ml-auto">
            {new Date(trace.generatedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="divide-y divide-white/5">
        {/* System prompt */}
        {trace.systemPrompt && (
          <div>
            <button
              onClick={() => setSysOpen(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-400 hover:text-white hover:bg-white/3 transition-colors"
            >
              {sysOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="font-medium">System Prompt</span>
              <span className="text-gray-600 ml-auto text-[10px]">{trace.systemPrompt.length} chars</span>
            </button>
            {sysOpen && (
              <div className="px-4 pb-3">
                <div className="flex justify-end mb-1.5">
                  <CopyButton text={trace.systemPrompt} />
                </div>
                <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed bg-black/30 rounded-lg p-3 max-h-64 overflow-y-auto border border-white/5">
                  {trace.systemPrompt}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* User message */}
        {trace.userMessage && (
          <div>
            <button
              onClick={() => setMsgOpen(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-400 hover:text-white hover:bg-white/3 transition-colors"
            >
              {msgOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="font-medium">User Message</span>
              <span className="text-gray-600 ml-auto text-[10px]">{trace.userMessage.length} chars</span>
            </button>
            {msgOpen && (
              <div className="px-4 pb-3">
                <div className="flex justify-end mb-1.5">
                  <CopyButton text={trace.userMessage} />
                </div>
                <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed bg-black/30 rounded-lg p-3 max-h-40 overflow-y-auto border border-white/5">
                  {trace.userMessage}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PromptsModal({ llmTrace, onClose }: { llmTrace: LlmTrace; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const entries = Object.entries(llmTrace).filter(([, v]) => v != null) as [string, TraceEntry][]

  if (!mounted) return null

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-panel border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-base font-semibold">LLM Prompts Used</h2>
            <p className="text-xs text-gray-500 mt-0.5">{entries.length} pipeline stage{entries.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No trace data recorded for this post yet.</p>
          ) : (
            entries.map(([key, trace]) => (
              <TraceSection key={key} label={TRACE_LABELS[key] ?? key} trace={trace} />
            ))
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
