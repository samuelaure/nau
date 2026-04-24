'use client'

import React, { useState } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
  className = '',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay)
    setTimeoutId(id)
  }

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId)
    setIsVisible(false)
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      className={`relative flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute z-50 px-2 py-1 text-[10px] font-medium text-white bg-zinc-900 border border-white/10 rounded shadow-xl whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${positionClasses[position]}`}
        >
          {content}
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-zinc-900 border-white/10 rotate-45 ${
              position === 'top'
                ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-b border-r'
                : position === 'bottom'
                  ? 'top-[-4px] left-1/2 -translate-x-1/2 border-t border-l'
                  : position === 'left'
                    ? 'right-[-4px] top-1/2 -translate-y-1/2 border-t border-r'
                    : 'left-[-4px] top-1/2 -translate-y-1/2 border-b border-l'
            }`}
          />
        </div>
      )}
    </div>
  )
}
