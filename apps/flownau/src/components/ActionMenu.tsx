'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'

interface ActionMenuProps {
  onDelete: () => Promise<void>
  onDuplicate?: () => Promise<void>
}

export default function ActionMenu({ onDelete, onDuplicate }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={menuRef} style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '50%',
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="hover:bg-white/5"
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <div
          className="glass"
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            width: '160px',
            padding: '4px',
            borderRadius: '8px',
            background: 'var(--panel-color)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            marginTop: '4px',
          }}
        >
          <form
            action={async () => {
              await onDelete()
              setIsOpen(false)
            }}
          >
            {/* If onDuplicate is provided, show it. But wait, Duplicate usually doesn't need a form action unless it's a server action directly passed. 
                            If onDuplicate is a function (client or bound server action), we can handle it.
                            The user Pattern seems to be passing server actions directly or wrapped.
                            Let's support an optional onDuplicate prop.
                        */}
            <DeleteButton />
          </form>
          {onDuplicate && (
            <div style={{ padding: '0 4px 4px 4px' }}>
              <button
                onClick={async (e) => {
                  e.preventDefault()
                  await onDuplicate()
                  setIsOpen(false)
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                Duplicate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeleteButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        border: 'none',
        background: 'transparent',
        color: 'var(--error)',
        cursor: pending ? 'wait' : 'pointer',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <Trash2 size={16} />
      {pending ? 'Deleting...' : 'Delete'}
    </button>
  )
}
