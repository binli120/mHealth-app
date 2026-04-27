/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { defineConfig, devices } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const IS_DEMO = process.env.DEMO_MODE === "true"
// When targeting a remote URL (cloud/staging), skip starting a local dev server
const IS_REMOTE = !BASE_URL.startsWith("http://localhost") && !BASE_URL.startsWith("http://127.0.0.1")
const DEMO_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_DEV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL_LOCAL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_LOCAL",
  "NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((env, rawLine) => {
      const line = rawLine.trim()
      if (!line || line.startsWith("#")) return env

      const separator = line.indexOf("=")
      if (separator === -1) return env

      const key = line.slice(0, separator).trim()
      let value = line.slice(separator + 1).trim()
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      env[key] = value
      return env
    }, {})
}

const demoEnvFile = loadEnvFile(path.join(__dirname, ".env.prod"))
const LOCAL_DEMO_ENV = IS_DEMO && !IS_REMOTE
  ? Object.fromEntries(
      DEMO_ENV_KEYS.flatMap((key) => {
        const value = demoEnvFile[key]
        return value ? [[key, value]] : []
      }),
    )
  : {}
const LOCAL_E2E_AUTH_ENV: Record<string, string> = !IS_REMOTE
  ? {
      NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS:
        process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS ?? "true",
      ENABLE_LOCAL_AUTH_HELPERS:
        process.env.ENABLE_LOCAL_AUTH_HELPERS ?? "true",
    }
  : {}

Object.assign(process.env, LOCAL_DEMO_ENV, LOCAL_E2E_AUTH_ENV)

export default defineConfig({
  testDir: "./e2e/tests",
  // Exclude demo recording scripts from the regular suite; they run via pnpm demo:* with DEMO_MODE=true
  testIgnore: [
    ...(IS_DEMO ? [] : ["**/demo-*.spec.ts"]),
    ...(IS_REMOTE ? ["**/10-dev-auth-security.spec.ts"] : []),
  ],
  // Demo needs more time for AI responses (Ollama); CI uses default 30s
  timeout: IS_DEMO ? 90_000 : 30_000,
  fullyParallel: !IS_DEMO,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: IS_DEMO ? 1 : process.env.CI ? 1 : 4,
  reporter: IS_DEMO
    ? [["list"]]
    : [
        ["html", { outputFolder: "e2e/report", open: "never" }],
        ["list"],
      ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Slow motion for demos so viewers can follow along
    launchOptions: {
      slowMo: IS_DEMO ? 1200 : 0,
    },
    headless: !IS_DEMO,
    video: IS_DEMO ? "on" : "off",
  },
  projects: [
    // Setup project: creates the demo user once before all tests.
    // Uses a dedicated timeout — ensureUser (×2, up to 10s each) +
    // loginAndSaveState waitForURL (×2, up to 20s each) can exceed the
    // default 30s global timeout.
    {
      name: "setup",
      // global.setup.ts lives in e2e/ (not e2e/tests/), so we need to
      // override testDir here; otherwise the global testDir setting prevents
      // Playwright from finding the file and the project silently skips.
      testDir: "./e2e",
      testMatch: /global\.setup\.ts/,
      timeout: 120_000,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: IS_DEMO ? { width: 1440, height: 900 } : { width: 1280, height: 720 },
      },
      dependencies: ["setup"],
    },
  ],
  // Start dev server only for local runs; skip when targeting a remote URL
  ...(IS_REMOTE
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            ...LOCAL_DEMO_ENV,
            ...LOCAL_E2E_AUTH_ENV,
            PATH: `/Users/blee/.nvm/versions/node/v20.12.2/bin:${process.env.PATH}`,
          },
        },
      }),
})
