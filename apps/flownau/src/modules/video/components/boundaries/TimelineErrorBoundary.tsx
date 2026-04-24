'use client'

import React, { Component, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class TimelineErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('TimelineErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-48 bg-[#161616] border-t border-border flex items-center justify-center">
          <div className="max-w-md w-full bg-panel/50 backdrop-blur-sm border border-error/20 rounded-xl p-6 text-center mx-4">
            <div className="w-10 h-10 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="text-error" size={20} />
            </div>

            <h3 className="text-sm font-bold text-text-primary mb-2">Timeline Error</h3>

            <p className="text-text-secondary text-xs mb-4">
              The timeline encountered an error. Your work is saved. Try refreshing.
            </p>

            {this.state.error && process.env.NODE_ENV === 'development' && (
              <div className="bg-background/50 border border-border rounded-lg p-2 mb-3 text-left">
                <p className="text-[9px] font-mono text-error truncate">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full px-3 py-2 bg-accent hover:bg-accent/90 rounded-lg text-xs font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
