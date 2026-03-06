/**
 * ErrorBoundary component to catch JavaScript errors anywhere in their child component tree.
 * Logs those errors and displays a fallback UI instead of crashing the whole app.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  /**
   * Updates state so the next render will show the fallback UI.
   * @param {Error} error - The caught error.
   * @returns {State} Updated state.
   */
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Logs error information to the console or an error reporting service.
   * @param {Error} error - The caught error.
   * @param {ErrorInfo} errorInfo - Component stack trace information.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            color: 'red',
            border: '1px solid red',
            margin: '20px',
            borderRadius: '8px',
            backgroundColor: '#fff5f5',
          }}
        >
          <h1>Algo salió mal.</h1>
          <p>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
