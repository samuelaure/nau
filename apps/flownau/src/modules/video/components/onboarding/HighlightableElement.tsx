'use client'

import React, { useEffect, useState } from 'react'
import { useOnboardingStore } from '../../store/useOnboardingStore'

/**
 * Wrapper component to make elements highlightable during onboarding
 */
export function HighlightableElement({
  id,
  children,
  className = '',
}: {
  id: string
  children: React.ReactNode
  className?: string
}) {
  const highlightedElement = useOnboardingStore((state) => state.highlightedElement)
  const isHighlighted = highlightedElement === id

  return (
    <div
      id={id}
      className={`
        ${className}
        ${isHighlighted ? 'relative z-[50] ring-4 ring-accent ring-offset-4 ring-offset-background rounded-xl transition-all duration-300' : ''}
      `}
    >
      {children}
    </div>
  )
}

/**
 * Hook to track element position for spotlight effect
 */
export function useElementSpotlight(elementId: string | null) {
  const [position, setPosition] = useState({ x: 50, y: 50 })

  useEffect(() => {
    if (!elementId) return

    const updatePosition = () => {
      const element = document.getElementById(elementId)
      if (element) {
        const rect = element.getBoundingClientRect()
        const x = ((rect.left + rect.width / 2) / window.innerWidth) * 100
        const y = ((rect.top + rect.height / 2) / window.innerHeight) * 100
        setPosition({ x, y })
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [elementId])

  return position
}
