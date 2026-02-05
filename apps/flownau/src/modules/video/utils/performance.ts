/**
 * Performance Monitoring Utilities
 * Provides FPS tracking and render time measurement
 */

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  renderTime: number
  timestamp: number
}

export class FPSMonitor {
  private frames: number[] = []
  private lastTime: number = performance.now()
  private rafId: number | null = null
  private callback: ((metrics: PerformanceMetrics) => void) | null = null

  start(callback: (metrics: PerformanceMetrics) => void) {
    this.callback = callback
    this.lastTime = performance.now()
    this.frames = []
    this.tick()
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.callback = null
  }

  private tick = () => {
    const now = performance.now()
    const delta = now - this.lastTime

    this.frames.push(delta)

    // Keep only last 60 frames
    if (this.frames.length > 60) {
      this.frames.shift()
    }

    // Calculate FPS
    const avgFrameTime = this.frames.reduce((a, b) => a + b, 0) / this.frames.length
    const fps = 1000 / avgFrameTime

    if (this.callback) {
      this.callback({
        fps: Math.round(fps),
        frameTime: avgFrameTime,
        renderTime: delta,
        timestamp: now,
      })
    }

    this.lastTime = now
    this.rafId = requestAnimationFrame(this.tick)
  }
}

/**
 * Measure render time of a component
 */
export class RenderTimeTracker {
  private measurements: Map<string, number[]> = new Map()

  startMeasure(componentName: string) {
    performance.mark(`${componentName}-start`)
  }

  endMeasure(componentName: string) {
    const startMark = `${componentName}-start`
    const endMark = `${componentName}-end`
    const measureName = `${componentName}-render`

    performance.mark(endMark)

    try {
      performance.measure(measureName, startMark, endMark)
      const measure = performance.getEntriesByName(measureName)[0]

      if (measure) {
        const times = this.measurements.get(componentName) || []
        times.push(measure.duration)

        // Keep only last 100 measurements
        if (times.length > 100) {
          times.shift()
        }

        this.measurements.set(componentName, times)
      }

      // Cleanup
      performance.clearMarks(startMark)
      performance.clearMarks(endMark)
      performance.clearMeasures(measureName)
    } catch (error) {
      console.warn(`Failed to measure ${componentName}:`, error)
    }
  }

  getStats(componentName: string): {
    avg: number
    min: number
    max: number
    count: number
  } | null {
    const times = this.measurements.get(componentName)
    if (!times || times.length === 0) return null

    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)

    return {
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      count: times.length,
    }
  }

  getAllStats() {
    const stats: Record<string, ReturnType<typeof this.getStats>> = {}
    this.measurements.forEach((_, componentName) => {
      stats[componentName] = this.getStats(componentName)
    })
    return stats
  }

  clear(componentName?: string) {
    if (componentName) {
      this.measurements.delete(componentName)
    } else {
      this.measurements.clear()
    }
  }
}

// Singleton instances
export const fpsMonitor = new FPSMonitor()
export const renderTimeTracker = new RenderTimeTracker()
