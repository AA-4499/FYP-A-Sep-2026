import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in view:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-slate-800">
          <div className="flex items-center gap-3 text-rose-700">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <h2 className="text-base font-bold">
              {this.props.fallbackTitle || 'Something went wrong displaying this view.'}
            </h2>
          </div>
          <p className="rounded-lg border border-rose-200 bg-white/80 p-3 font-mono text-xs leading-relaxed text-rose-800 break-words">
            {this.state.error?.message || 'An unexpected runtime error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload view
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
