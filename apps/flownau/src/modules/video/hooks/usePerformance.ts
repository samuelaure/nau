import { useEffect, useState, useRef } from 'react'
import { fpsMonitor, renderTimeTracker, PerformanceMetrics } from '../utils/performance'

/**
 * Hook to monitor FPS
 */
export function useFPSMonitor(enabled = true) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    renderTime: 0,
    timestamp: 0,
  })

  useEffect(() => {
    if (!enabled) return

    fpsMonitor.start((newMetrics) => {
      setMetrics(newMetrics)
    })

    return () => {
      fpsMonitor.stop()
    }
  }, [enabled])

  return metrics
}

/**
 * Hook to track component render time
 */
export function useRenderTime(componentName: string, enabled = true) {
  const renderCount = useRef(0)

  useEffect(() => {
    if (!enabled) return

    renderCount.current++

    if (renderCount.current > 1) {
      // Skip first render
      renderTimeTracker.endMeasure(componentName)
    }

    renderTimeTracker.startMeasure(componentName)
  })

  return {
    getStats: () => renderTimeTracker.getStats(componentName),
    clear: () => renderTimeTracker.clear(componentName),
  }
}

/**
 * Hook to get all render time stats
 */
export function useAllRenderStats(enabled = true) {
  const [stats, setStats] = useState<ReturnType<typeof renderTimeTracker.getAllStats>>({})

  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      setStats(renderTimeTracker.getAllStats())
    }, 1000)

    return () => clearInterval(interval)
  }, [enabled])

  return stats
}

/**
 * Hook to detect performance issues
 */
export function usePerformanceWarnings(fpsThreshold = 30) {
  const metrics = useFPSMonitor()
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    const newWarnings: string[] = []

    if (metrics.fps < fpsThreshold) {
      newWarnings.push(`Low FPS: ${metrics.fps} (target: 60)`)
    }

    if (metrics.frameTime > 50) {
      newWarnings.push(`High frame time: ${metrics.frameTime.toFixed(2)}ms`)
    }

    setWarnings(newWarnings)
  }, [metrics, fpsThreshold])

  return warnings
}
