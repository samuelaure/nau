import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface TraceEntry {
  systemPrompt?: string
  userMessage?: string
  model?: string
  generatedAt?: string
}

interface Props {
  title: string
  trace: TraceEntry
  onClose: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: copied ? '#3fb950' : '#6e7681', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function ExpandableBlock({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', fontSize: '12px' }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#6e7681' }}>{text.length} chars</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
            <CopyButton text={text} />
          </div>
          <pre style={{
            fontSize: '11px', color: '#c9d1d9', whiteSpace: 'pre-wrap', fontFamily: 'monospace',
            lineHeight: 1.6, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px',
            minHeight: '8rem', maxHeight: '24rem', overflowY: 'auto', resize: 'vertical',
            border: '1px solid rgba(255,255,255,0.05)', margin: 0,
          }}>
            {text}
          </pre>
        </div>
      )}
    </div>
  )
}

export const PromptsModal = ({ title, trace, onClose }: Props) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: '720px',
        background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', display: 'flex', flexDirection: 'column', maxHeight: '85vh',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>LLM Prompts Used</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6e7681' }}>{title}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6e7681', cursor: 'pointer', padding: '4px', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.8)' }}>Synthesis</span>
            {trace.model && <span style={{ fontSize: '10px', color: '#6e7681', fontFamily: 'monospace' }}>{trace.model}</span>}
            {trace.generatedAt && (
              <span style={{ fontSize: '10px', color: '#6e7681', marginLeft: 'auto' }}>
                {new Date(trace.generatedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {trace.systemPrompt && <ExpandableBlock label="System Prompt" text={trace.systemPrompt} />}
          {trace.userMessage && <ExpandableBlock label="User Message" text={trace.userMessage} />}
          {!trace.systemPrompt && !trace.userMessage && (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#6e7681', fontSize: '0.875rem' }}>
              No trace data recorded for this item yet. Only new syntheses will have trace data.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
