/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import path from "node:path"
// Also prepare the decoder when Next is started directly by a hosting platform.
import "./scripts/copy-zxing-wasm.mjs"
import { execSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import { composeAppVersion } from "./lib/build-version.mjs"

const require = createRequire(import.meta.url)
const { version } = require("./package.json")

// ── Build stamp ──────────────────────────────────────────────────────────────
//
// The patch segment of the app version is the build number: `git rev-list
// --count HEAD`. CI passes it (and the short SHA) as NEXT_PUBLIC_BUILD_NUMBER /
// NEXT_PUBLIC_BUILD_SHA build args because `.git` is excluded from the Docker
// build context. For a local `npm run build` we fall back to reading git
// directly, then to "0" if even that fails.
function readGit(command) {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()
  } catch {
    return ""
  }
}

const buildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER || readGit("git rev-list --count HEAD") || "0"
const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA || readGit("git rev-parse --short HEAD") || ""
const appVersion = composeAppVersion(version, buildNumber)

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
  // Tells ngrok not to show its browser-warning interstitial page.
  // Safe to include unconditionally — non-ngrok proxies ignore this header.
  { key: "ngrok-skip-browser-warning", value: "true" },
  // Prevent the page from being embedded in a frame (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent browsers from MIME-sniffing the content type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Force HTTPS for 2 years, include subdomains, allow preload
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Limit referrer information sent to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser feature access — camera for identity scan, microphone for
  // intake-chat voice input. proxy.ts sends the authoritative per-request value;
  // keep this fallback in sync.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
  output: "standalone",
  experimental: {
    // Upload routes enforce their own per-category limits (10-25 MB). Keep
    // Next's proxy body ceiling above the largest app-level limit so validation
    // can return structured 413 responses instead of truncated multipart parse
    // failures.
    proxyClientMaxBodySize: "30mb",
  },
  // Keep pdf-parse and pdfjs-dist out of the server bundle.
  // Both use DOMMatrix / process.getBuiltinModule at module-eval time which
  // crashes the Turbopack build worker on Node < 22.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "canvas"],
  // lib/pdf/extract-pdf-json.ts lazily `import("pdf-parse")`s it — a literal
  // specifier, so Next's standalone output tracer follows it and correctly
  // auto-discovers pdf-parse + pdfjs-dist with zero manual assist. One file
  // still needs a manual nudge: pdfjs-dist's "fake worker" fallback (used
  // whenever a real Worker thread isn't available, which is always true in a
  // Next.js server route) loads pdf.worker.mjs via a runtime-computed path,
  // invisible to static tracing — so it's present in `pnpm install` but
  // missing from .next/standalone, and text extraction throws
  // "Setting up fake worker failed: Cannot find module ... pdf.worker.mjs" in
  // prod without this. Anchored at the pnpm-store path pdf-parse resolves
  // from (see the extractPdfJson comment for why a flattened top-level glob
  // wouldn't land in a reachable spot); pulling in all of dist/ rather than
  // guessing the one worker variant actually used keeps this from silently
  // breaking again if pdf-parse changes which build it loads.
  outputFileTracingIncludes: {
    "/api/appeals/extract-document": ["./node_modules/.pnpm/pdf-parse@*/node_modules/pdf-parse/dist/**"],
    "/api/pdf/extract": ["./node_modules/.pnpm/pdf-parse@*/node_modules/pdf-parse/dist/**"],
    "/api/agents/vision": ["./node_modules/.pnpm/pdf-parse@*/node_modules/pdf-parse/dist/**"],
    "/api/documents/parse-application": ["./node_modules/.pnpm/pdf-parse@*/node_modules/pdf-parse/dist/**"],
    "/api/masshealth/income-verification/extract": [
      "./node_modules/.pnpm/pdf-parse@*/node_modules/pdf-parse/dist/**",
    ],
  },
  // 127.0.0.1 is required for Playwright e2e tests (PORT=3001 pnpm dev)
  allowedDevOrigins: ["127.0.0.1", "192.168.86.25", "192.168.1.92", "192.168.1.47", "*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.io"],
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
