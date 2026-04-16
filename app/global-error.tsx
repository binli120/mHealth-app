"use client"

import { AlertTriangle } from "lucide-react"

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// global-error wraps the root layout, so it must supply its own <html> and <body>.
// Keep it dependency-free — no ThemeProvider, no Radix, no Redux — since the
// layout itself may have failed to render.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f9fafb",
          color: "#111827",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 400 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "#fee2e2",
              marginBottom: "1.5rem",
            }}
          >
            <AlertTriangle style={{ width: 32, height: 32, color: "#dc2626" }} />
          </div>

          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1.5rem" }}>
            A critical error occurred. Please refresh the page or contact support if the problem
            persists.
          </p>

          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "1.5rem" }}>
              Error ID: {error.digest}
            </p>
          )}

          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: 8,
              border: "none",
              backgroundColor: "#1d4ed8",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
