'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!mounted || !isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        // Close if clicked directly on the overlay
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-lg p-8 bg-panel shadow-2xl max-h-[90vh] overflow-y-auto border border-white/10 rounded-2xl animate-slide-up glass">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-text-secondary hover:bg-white/10 transition-colors"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
