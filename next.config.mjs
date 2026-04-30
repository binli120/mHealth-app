/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const { version } = require("./package.json")

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const projectNodeModules = path.join(projectRoot, "node_modules")

function normalizeResolveModules(modules) {
  const normalized = []
  const input = Array.isArray(modules) ? modules : modules ? [modules] : []

  for (const entry of input) {
    if (typeof entry !== "string") {
      normalized.push(entry)
      continue
    }

    const segments = entry.split(path.delimiter).filter(Boolean)
    if (segments.length === 0) {
      continue
    }

    normalized.push(...segments)
  }

  return [...new Set(normalized)]
}

// ── Static security headers ───────────────────────────────────────────────────
//
// These headers are set by next.config.mjs for every route.
//
// Content-Security-Policy is intentionally absent here.
// It is generated per-request by proxy.ts with a fresh nonce so that
// script-src can use 'nonce-{value}' instead of the weaker 'unsafe-inline'.
// See: proxy.ts, lib/csp/nonce.ts
const securityHeaders = [
  // Prevent the page from being embedded in a frame (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent browsers from MIME-sniffing the content type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Force HTTPS for 2 years, include subdomains, allow preload
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Limit referrer information sent to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser feature access — camera allowed for identity scan
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  output: "standalone",
  // Keep pdf-parse and pdfjs-dist out of the server bundle.
  // Both use DOMMatrix / process.getBuiltinModule at module-eval time which
  // crashes the Turbopack build worker on Node < 22.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "canvas"],
  allowedDevOrigins: ["192.168.86.25", "192.168.1.92", "192.168.1.47"],
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }]
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "image.thum.io",
      },
    ],
  },
  webpack: (config) => {
    const existingModules = normalizeResolveModules(config.resolve?.modules)
    config.resolve = config.resolve ?? {}
    config.resolve.modules = [
      projectNodeModules,
      ...existingModules,
    ]

    return config
  },
}

export default nextConfig
