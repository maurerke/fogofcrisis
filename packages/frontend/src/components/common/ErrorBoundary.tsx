import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            color: "#e2e8f0",
            backgroundColor: "#0f172a",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Ein unerwarteter Fehler ist aufgetreten
          </h1>
          <p style={{ color: "#94a3b8", marginBottom: "1.5rem", textAlign: "center", maxWidth: "500px" }}>
            Bitte laden Sie die Seite neu. Ihre bisherigen Antworten wurden automatisch gespeichert.
            Falls das Problem weiterhin besteht, kontaktieren Sie den Studienleiter.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Seite neu laden
          </button>
          {this.state.error && (
            <details style={{ marginTop: "2rem", color: "#64748b", fontSize: "0.75rem", maxWidth: "600px" }}>
              <summary>Technische Details</summary>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
