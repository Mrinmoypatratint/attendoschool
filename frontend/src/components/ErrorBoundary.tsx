import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-50 p-6 font-sans">
          <div className="max-w-[480px] w-full bg-slate-800 rounded-2xl p-8 text-center shadow-2xl border border-white/10">
            <div className="w-14 h-14 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-xl font-bold mb-2 text-white">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              A temporary display error occurred. Please refresh the page to restore your dashboard.
            </p>
            {this.state.error && (
              <div className="mb-6 p-3 bg-red-950/60 border border-red-500/30 rounded-lg text-left overflow-auto max-h-48 text-xs font-mono text-red-300">
                <div className="font-bold text-red-200 mb-1">{this.state.error.name}: {this.state.error.message}</div>
                {this.state.error.stack && (
                  <div className="text-[10px] text-red-400 whitespace-pre-wrap leading-tight max-h-32 overflow-y-auto">
                    {this.state.error.stack}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors shadow-sm"
            >
              <RefreshCw size={16} /> Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
