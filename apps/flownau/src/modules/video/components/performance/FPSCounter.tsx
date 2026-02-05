'use client'

import React, { useState } from 'react'
import { Activity, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useFPSMonitor, useAllRenderStats } from '../../hooks/usePerformance'

interface FPSCounterProps {
  /**
   * Position of the counter
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /**
   * Show only in development mode
   */
  devOnly?: boolean
}

export function FPSCounter({ position = 'top-right', devOnly = true }: FPSCounterProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const metrics = useFPSMonitor(isVisible)
  const renderStats = useAllRenderStats(isVisible && isExpanded)

  // Hide in production if devOnly is true
  if (devOnly && process.env.NODE_ENV === 'production') {
    return null
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-2 bg-panel/80 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-panel transition-all z-50"
        title="Show performance monitor"
      >
        <Activity size={16} className="text-accent" />
      </button>
    )
  }

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  }

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'text-success'
    if (fps >= 30) return 'text-yellow-500'
    return 'text-error'
  }

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 select-none`}
      style={{ fontFamily: 'monospace' }}
    >
      <div className="bg-panel/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-white/[0.02] border-b border-white/5">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">
              Performance
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp size={12} className="text-white/60" />
              ) : (
                <ChevronDown size={12} className="text-white/60" />
              )}
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Hide"
            >
              <X size={12} className="text-white/60" />
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="p-3 space-y-2">
          {/* FPS */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">FPS</span>
            <span className={`text-lg font-bold ${getFPSColor(metrics.fps)}`}>{metrics.fps}</span>
          </div>

          {/* Frame Time */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Frame Time</span>
            <span className="text-xs text-white/80">{metrics.frameTime.toFixed(2)}ms</span>
          </div>

          {/* Expanded Stats */}
          {isExpanded && (
            <>
              <div className="border-t border-white/5 pt-2 mt-2">
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Render Times
                </div>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {Object.entries(renderStats).length === 0 ? (
                    <div className="text-[9px] text-white/20 italic">No data yet</div>
                  ) : (
                    Object.entries(renderStats).map(([name, stats]) => {
                      if (!stats) return null
                      return (
                        <div key={name} className="space-y-0.5">
                          <div className="text-[9px] text-white/60 truncate" title={name}>
                            {name}
                          </div>
                          <div className="flex items-center justify-between text-[8px] text-white/40">
                            <span>Avg: {stats.avg}ms</span>
                            <span>Min: {stats.min}ms</span>
                            <span>Max: {stats.max}ms</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Performance Tips */}
              {metrics.fps < 30 && (
                <div className="border-t border-white/5 pt-2 mt-2">
                  <div className="text-[9px] text-error bg-error/10 border border-error/20 rounded-lg p-2">
                    ⚠️ Low FPS detected. Consider reducing timeline complexity or disabling effects.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
