import React from 'react'
import { Type, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useWaitForFonts } from '../../hooks/useFontLoading'

interface FontLoadingIndicatorProps {
  /**
   * Position of the indicator
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /**
   * Show only during loading (auto-hide when complete)
   */
  autoHide?: boolean
  /**
   * Timeout in milliseconds
   */
  timeout?: number
}

export function FontLoadingIndicator({
  position = 'bottom-right',
  autoHide = true,
  timeout = 3000,
}: FontLoadingIndicatorProps) {
  const { ready, timedOut } = useWaitForFonts(timeout)
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    if (ready && autoHide) {
      // Delay hiding to show success state briefly
      const timer = setTimeout(() => setVisible(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [ready, autoHide])

  if (!visible) return null

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  }

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 pointer-events-none animate-fade-in`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-panel/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-2xl">
        {!ready && (
          <>
            <Loader2 size={14} className="text-accent animate-spin" />
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              Loading Fonts...
            </span>
          </>
        )}
        {ready && !timedOut && (
          <>
            <CheckCircle2 size={14} className="text-success" />
            <span className="text-[10px] font-bold text-success uppercase tracking-wider">
              Fonts Ready
            </span>
          </>
        )}
        {ready && timedOut && (
          <>
            <AlertCircle size={14} className="text-error" />
            <span className="text-[10px] font-bold text-error uppercase tracking-wider">
              Font Timeout
            </span>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Minimal inline font loading indicator for use in components
 */
export function InlineFontLoadingIndicator() {
  const { ready, timedOut } = useWaitForFonts(2000)

  if (ready && !timedOut) return null

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/[0.03] border border-white/5 rounded-md">
      {!ready && (
        <>
          <Type size={10} className="text-accent animate-pulse" />
          <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
            Loading...
          </span>
        </>
      )}
      {ready && timedOut && (
        <>
          <AlertCircle size={10} className="text-error" />
          <span className="text-[9px] font-bold text-error uppercase tracking-widest">
            Font Error
          </span>
        </>
      )}
    </div>
  )
}
