"use client";

import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
            <span className="text-2xl" aria-hidden>⚠</span>
          </div>
          <div>
            <p className="text-base font-bold text-on-page">Something went wrong</p>
            <p className="mt-1 text-sm text-muted">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
            className="rounded-xl bg-on-page/10 px-5 py-2.5 text-sm font-semibold text-on-page transition hover:bg-on-page/20"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
