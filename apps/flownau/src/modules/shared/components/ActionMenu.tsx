'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Trash2, Copy } from 'lucide-react'
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
    <div ref={menuRef} className="absolute top-4 right-4 z-10">
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="w-9 h-9 flex items-center justify-center rounded-full text-text-secondary hover:bg-white/5 transition-colors"
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-40 p-1 bg-panel border border-border shadow-xl rounded-lg z-20 glass animate-fade-in">
          <form
            action={async () => {
              await onDelete()
              setIsOpen(false)
            }}
          >
            <DeleteButton />
          </form>
          {onDuplicate && (
            <button
              onClick={async (e) => {
                e.preventDefault()
                await onDuplicate()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-2 p-2.5 rounded-md text-sm font-medium text-text-primary hover:bg-white/5 transition-colors"
            >
              <Copy size={16} />
              Duplicate
            </button>
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
      className="w-full flex items-center gap-2 p-2.5 rounded-md text-sm font-medium text-error hover:bg-error/10 transition-colors disabled:opacity-50 disabled:cursor-wait"
    >
      <Trash2 size={16} />
      {pending ? 'Deleting...' : 'Delete'}
    </button>
  )
}
