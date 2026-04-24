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

export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CanvasErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 bg-background flex items-center justify-center p-10">
          <div className="max-w-sm w-full bg-panel/50 backdrop-blur-sm border border-error/20 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="text-error" size={24} />
            </div>

            <h3 className="text-lg font-bold text-text-primary mb-2">Canvas Error</h3>

            <p className="text-text-secondary text-xs mb-6">
              The canvas failed to load. Try refreshing or check the browser console for details.
            </p>

            {this.state.error && process.env.NODE_ENV === 'development' && (
              <div className="bg-background/50 border border-border rounded-lg p-3 mb-4 text-left">
                <p className="text-[10px] font-mono text-error">{this.state.error.message}</p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full px-4 py-2.5 bg-accent hover:bg-accent/90 rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
