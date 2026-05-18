import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  label: string
  defaultOpen?: boolean
  tag?: ReactNode
  count?: number
  children: ReactNode
}

export const CollapsibleSection = ({ label, defaultOpen = true, tag, count, children }: Props) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: open ? '0.6rem' : 0 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
            color: '#8b949e', fontSize: '0.78rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {label}
          {count !== undefined && <span style={{ color: '#6e7681', fontWeight: 500, marginLeft: '0.25rem' }}>({count})</span>}
        </button>
        {tag}
      </div>
      {open && children}
    </section>
  )
}
