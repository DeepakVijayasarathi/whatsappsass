"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error card for debugging context */
  label?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Production: forward to your error tracker (Sentry, etc.)
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center animate-fade-in"
        >
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
            <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-1.5">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-500 mb-1 max-w-sm leading-relaxed">
            {this.props.label
              ? `An unexpected error occurred in ${this.props.label}.`
              : "An unexpected error occurred. The page may be in an inconsistent state."}
          </p>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="mt-3 mb-5 text-left text-xs bg-gray-50 border border-gray-200 rounded-xl p-4 max-w-lg w-full overflow-auto text-red-600 shadow-xs">
              {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleReset}
            className="btn-secondary mt-4 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
