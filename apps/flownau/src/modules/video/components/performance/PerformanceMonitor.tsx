'use client'

import React from 'react'
import { useRenderTime } from '../../hooks/usePerformance'

interface PerformanceMonitorProps {
  /**
   * Name of the component being monitored
   */
  name: string
  /**
   * Enable monitoring
   */
  enabled?: boolean
  /**
   * Children to render
   */
  children: React.ReactNode
  /**
   * Log render times to console
   */
  logToConsole?: boolean
}

/**
 * Wrapper component to monitor render performance of children
 */
export function PerformanceMonitor({
  name,
  enabled = process.env.NODE_ENV === 'development',
  children,
  logToConsole = false,
}: PerformanceMonitorProps) {
  const { getStats } = useRenderTime(name, enabled)

  React.useEffect(() => {
    if (!enabled || !logToConsole) return

    const interval = setInterval(() => {
      const stats = getStats()
      if (stats) {
        console.log(`[Performance] ${name}:`, stats)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [enabled, logToConsole, name, getStats])

  return <>{children}</>
}
