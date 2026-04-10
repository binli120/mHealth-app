import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // 'server-only' is a Next.js compile-time guard with no runtime behaviour.
      // Map it to an empty stub so route-handler and lib tests can import server
      // modules without throwing.
      "server-only": path.resolve(__dirname, "vitest.mocks/server-only.ts"),
    },
  },
  test: {
    // jsdom covers all component / hook tests; pure-function tests run fine
    // under jsdom too, so a single global environment is sufficient.
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        // jsdom requires a URL to enable localStorage / sessionStorage.
        url: "http://localhost/",
      },
    },
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.claude/**",
      "e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      reportsDirectory: "coverage",
      // Files that must be covered — API handlers, business logic, utilities.
      // Components are covered separately; type-only and barrel files are excluded.
      include: [
        "app/api/**/*.ts",
        "lib/**/*.ts",
      ],
      exclude: [
        "**/node_modules/**",
        "**/__tests__/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/types.ts",
        "**/types/**",
        "lib/redux/**",          // Redux boilerplate — slices are integration-tested via UI
        "lib/supabase/client.ts", // Browser singleton — no testable logic
      ],
      // Thresholds are set to the current baseline and should be raised
      // incrementally as new tests are added (see TEST_PLAN.md sprint plan).
      // Target: all four at 90% by end of Sprint 5.
      thresholds: {
        lines:      48,
        functions:  78,
        branches:   80,
        statements: 48,
      },
    },
  },
})
