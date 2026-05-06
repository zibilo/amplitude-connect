import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

/** Global error boundary to prevent crashes from bubbling to a white screen. */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="max-w-md w-full rounded-lg border border-destructive/30 bg-card p-6 space-y-3">
              <h2 className="text-lg font-semibold text-destructive">Une erreur est survenue</h2>
              <p className="text-sm text-muted-foreground break-words">
                {this.state.error?.message ?? "Erreur inconnue"}
              </p>
              <button
                onClick={this.reset}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90"
              >
                Réessayer
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}