import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100vh", padding: "40px",
          fontFamily: "sans-serif", textAlign: "center", background: "#f8f9fa"
        }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "12px", color: "#dc3545" }}>Something went wrong</h1>
          <p style={{ color: "#666", marginBottom: "24px", maxWidth: "480px" }}>
            The application encountered an unexpected error. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 32px", fontSize: "16px", fontWeight: 600,
              color: "#fff", background: "#0d6efd", border: "none",
              borderRadius: "8px", cursor: "pointer"
            }}
          >
            Refresh Page
          </button>
          {this.state.error && (
            <details style={{ marginTop: "24px", color: "#999", fontSize: "12px" }}>
              <summary>Error details</summary>
              <pre style={{ marginTop: "8px", whiteSpace: "pre-wrap" }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
