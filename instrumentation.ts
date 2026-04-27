/**
 * Next.js OpenTelemetry instrumentation — ships traces to OpenObserve.
 * Loaded automatically by Next.js 15+ on every server start.
 *
 * Requires env vars:
 *   OPENOBSERVE_URL      — e.g. http://your-host:5080
 *   OPENOBSERVE_USER     — e.g. admin@example.com
 *   OPENOBSERVE_PASSWORD — e.g. ChangeMe123!
 *   OPENOBSERVE_ORG      — (optional) defaults to "default"
 *
 * @author Bin Lee
 */

export async function register() {
  // Only run in the Node.js server runtime, not in the Edge runtime
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // Fail loudly at startup if dev auth helpers are accidentally enabled in
  // production. These routes bypass Supabase Auth and must never be reachable
  // in a production environment.
  if (process.env.NODE_ENV === "production") {
    const flagValue =
      process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS ??
      process.env.ENABLE_LOCAL_AUTH_HELPERS
    const isEnabled =
      flagValue?.trim().toLowerCase() === "true" ||
      flagValue?.trim() === "1" ||
      flagValue?.trim().toLowerCase() === "yes"

    if (isEnabled) {
      throw new Error(
        "[SECURITY] NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS or ENABLE_LOCAL_AUTH_HELPERS " +
          "is set to a truthy value in a production environment. " +
          "This enables dev-only auth routes that bypass Supabase Auth and must never " +
          "be active in production. Remove or set this variable to 'false' before deploying.",
      )
    }
  }

  const url  = process.env.OPENOBSERVE_URL
  const user = process.env.OPENOBSERVE_USER
  const pass = process.env.OPENOBSERVE_PASSWORD

  if (!url || !user || !pass) {
    // Tracing is opt-in — skip silently when env vars are absent
    return
  }

  const org  = process.env.OPENOBSERVE_ORG ?? "default"
  const auth = Buffer.from(`${user}:${pass}`).toString("base64")

  // Dynamic imports keep these packages out of the client bundle
  const { NodeSDK }                   = await import("@opentelemetry/sdk-node")
  const { OTLPTraceExporter }         = await import("@opentelemetry/exporter-trace-otlp-http")
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node")
  const { resourceFromAttributes }    = await import("@opentelemetry/resources")

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name":           "mhealth-app",
      "service.version":        process.env.npm_package_version ?? "0.0.0",
      "deployment.environment": process.env.NODE_ENV ?? "development",
    }),
    traceExporter: new OTLPTraceExporter({
      url:     `${url}/api/${org}/traces`,
      headers: { Authorization: `Basic ${auth}` },
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy fs instrumentation — not useful for request tracing
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  })

  sdk.start()

  console.info(
    `[instrumentation] OpenTelemetry tracing active → ${url}/api/${org}/traces`,
  )
}
