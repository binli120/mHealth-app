/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Content-Security-Policy builder for nonce-based CSP.
 *
 * Design decisions
 * ───────────────────────────────────────────────────────────────────────────
 * script-src  – 'unsafe-inline' is REMOVED and replaced by 'nonce-{value}'.
 *               'strict-dynamic' is added so scripts loaded by trusted (nonce-
 *               bearing) scripts inherit trust — this is essential for Next.js's
 *               dynamic chunk loading strategy.
 *
 * style-src   – 'unsafe-inline' is KEPT intentionally.  Radix UI primitives
 *               (Dialog, Tooltip, Popover …) and Recharts both inject inline
 *               style= attributes for positioning/sizing that CSP nonces cannot
 *               protect (nonces only apply to <style> elements, not to style=
 *               attributes).  Removing 'unsafe-inline' from style-src would
 *               silently break those components at runtime.
 *
 * Nonce format – 16 random bytes encoded as base64 (128 bits of entropy),
 *                generated via Web Crypto so it works in both Node.js and
 *                Edge Runtime without Buffer polyfills.
 */

export interface CspOptions {
  /** Base64-encoded random nonce for the current request. */
  nonce: string
  /** Enables 'unsafe-eval' in script-src (Turbopack HMR in development). */
  isDev?: boolean
  /**
   * Supabase project host for connect-src.
   * Defaults to the value derived from NEXT_PUBLIC_SUPABASE_URL if omitted,
   * or "*.supabase.co" when neither is available (e.g. in unit tests).
   */
  supabaseHost?: string
}

/**
 * Generate a cryptographically random nonce.
 *
 * Uses the Web Crypto API so it works in Edge Runtime, Node.js, and browsers
 * without relying on Buffer or Node-specific APIs.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // btoa requires a latin-1 binary string
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Build the Content-Security-Policy header value for a given request nonce.
 *
 * @example
 * const nonce = generateNonce()
 * const csp   = buildCspHeader({ nonce, isDev: false })
 * // → "default-src 'self'; script-src 'self' 'nonce-abc123' 'strict-dynamic'; ..."
 */
export function buildCspHeader(opts: CspOptions): string {
  const { nonce, isDev = false } = opts

  // Resolve the Supabase host from env at call-time so tests can override it
  // without needing to mock module-level constants.
  const supabaseHost =
    opts.supabaseHost ??
    (process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : "*.supabase.co")

  const directives: string[] = [
    "default-src 'self'",

    // 'nonce-{value}' replaces 'unsafe-inline'.
    // 'strict-dynamic' propagates trust to scripts loaded by nonce-bearing scripts
    // (Next.js lazy chunks, React streaming scripts, etc.).
    // 'unsafe-eval' is added only in development for Turbopack HMR.
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ].join(" "),

    // Kept 'unsafe-inline': Radix UI + Recharts use inline style= attributes.
    "style-src 'self' 'unsafe-inline'",

    // Supabase REST, Auth, Realtime WebSocket
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,

    // Images: data URIs (base64 avatars), blobs (camera captures), YouTube
    // thumbnails (embedded video), and Thum.io screenshot previews.
    "img-src 'self' data: blob: https://img.youtube.com https://image.thum.io",

    // Google Fonts serve woff2 over https; data: covers inlined icon fonts.
    "font-src 'self' data:",

    // Voice/video blobs for accessibility features
    "media-src 'self' blob:",

    // PDF.js web worker runs as a blob: URL
    "worker-src blob:",

    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]

  return directives.join("; ")
}
