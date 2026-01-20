import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-view">
          <AlertTriangle size={48} color="var(--accent)" />
          <h2>Something went wrong</h2>
          <p>The dashboard encountered an unexpected error.</p>
          <pre
            style={{
              fontSize: '0.75rem',
              background: 'rgba(0,0,0,0.3)',
              padding: '1rem',
              borderRadius: '0.5rem',
              maxWidth: '100%',
              overflow: 'auto',
            }}
          >
            {this.state.error?.message}
          </pre>
          <button onClick={() => window.location.reload()}>
            <RefreshCcw size={16} style={{ marginRight: '8px' }} />
            Reload Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
