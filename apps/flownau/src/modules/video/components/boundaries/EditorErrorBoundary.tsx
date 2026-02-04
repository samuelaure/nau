'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('EditorErrorBoundary caught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-8">
          <div className="max-w-md w-full bg-panel border border-border rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-error" size={32} />
            </div>

            <h1 className="text-2xl font-bold text-text-primary mb-3">Editor Error</h1>

            <p className="text-text-secondary text-sm mb-6">
              The video editor encountered an unexpected error. Your work may have been autosaved.
            </p>

            {this.state.error && (
              <div className="bg-background border border-border rounded-lg p-4 mb-6 text-left">
                <p className="text-xs font-mono text-error mb-2">{this.state.error.message}</p>
                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <details className="text-xs font-mono text-text-secondary mt-2">
                    <summary className="cursor-pointer hover:text-text-primary">
                      Stack trace
                    </summary>
                    <pre className="mt-2 overflow-auto max-h-40 text-[10px]">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-text-primary transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent/90 rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                Reload Editor
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
