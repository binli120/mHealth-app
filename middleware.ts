/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Next.js middleware — runs on the Edge Runtime before every matched request.
 *
 * Responsibilities
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Generate a fresh cryptographic nonce for each request.
 * 2. Build a Content-Security-Policy that uses 'nonce-{value}' in script-src
 *    instead of the weaker 'unsafe-inline'.
 * 3. Forward the nonce to the page handler via the x-nonce request header so
 *    Next.js App Router can attach it to its inline hydration <script> tags.
 * 4. Set the CSP as a response header so browsers enforce it.
 *
 * Excluded from the matcher (handled by Next.js file server directly):
 *   • _next/static  — immutable JS/CSS bundles; no inline scripts
 *   • _next/image   — image optimization endpoint
 *   • Public assets — favicon, apple-icon, manifest, robots, sitemap
 *   • Prefetch requests — Next.js router prefetch headers (no document rendered)
 *
 * Note on style-src
 * ─────────────────────────────────────────────────────────────────────────────
 * 'unsafe-inline' remains in style-src because Radix UI primitives (Dialog,
 * Tooltip, Popover …) and Recharts both set inline style= attributes that CSP
 * nonces cannot cover (nonces only protect <style> elements, not attributes).
 */

import { buildCspHeader, generateNonce } from '@/lib/csp/nonce';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === 'development';
  const csp = buildCspHeader({ nonce, isDev });

  // Clone the incoming headers so we can add x-nonce.
  // NextResponse.next({ request: { headers } }) forwards these to the page
  // handler — Next.js App Router reads x-nonce internally and applies it to
  // the inline <script> tags it generates for RSC/hydration.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Also forward the CSP via request headers so server components can read it
  // if needed (e.g. for a Report-Only header or debugging).
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set the enforcing CSP on the response so browsers act on it.
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

// ── Matcher ───────────────────────────────────────────────────────────────────
//
// Run on every page route and API route, but skip:
//   • Static assets served by the Next.js file server
//   • Public directory files (favicon, icons, manifests)
//   • Prefetch requests (no document rendered; CSP would be wasted)

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon|apple-icon|manifest|robots\\.txt|sitemap\\.xml).*)',
      missing: [
        // Skip client-side prefetch navigation (no full document)
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
