import { defineConfig, devices } from "@playwright/test"

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const IS_DEMO = process.env.DEMO_MODE === "true"

export default defineConfig({
  testDir: "./e2e/tests",
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
    // Setup project: creates the demo user once before all tests
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
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
  // Start dev server if not already running
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      PATH: `/Users/blee/.nvm/versions/node/v20.12.2/bin:${process.env.PATH}`,
    },
  },
})
