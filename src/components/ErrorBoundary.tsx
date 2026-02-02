import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[Lenia Lab] Caught error:', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-content">
            <h2>⚠️ Something went wrong</h2>
            <p className="error-message">{this.state.error}</p>
            <p className="error-hint">
              This usually means WebGL is not available or the GPU context was lost.
              Try reloading the page.
            </p>
            <div className="error-actions">
              <button className="btn btn-primary" onClick={this.handleRetry}>
                Try Again
              </button>
              <button className="btn" onClick={() => window.location.reload()}>
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
