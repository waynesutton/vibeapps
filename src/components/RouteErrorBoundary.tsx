import React from "react";

type Props = {
  children: React.ReactNode;
  // Clears the error when this changes, so navigating away recovers
  resetKey?: string;
};

type State = { hasError: boolean };

// Catches render errors and failed lazy route chunks so the rest of the app stays usable
export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Route failed to render", error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="max-w-md mx-auto my-12 bg-surface border border-hairline rounded-lg p-6 text-center"
      >
        <h2 className="text-lg font-semibold text-ink">
          This page did not load
        </h2>
        <p className="text-sm text-soft mt-2">
          A newer version of Vibe Apps may be live. Reload to get it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-cta text-on-cta text-sm font-semibold rounded-md hover:bg-cta-hover transition-colors"
        >
          Reload page
        </button>
      </div>
    );
  }
}
