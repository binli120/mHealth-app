import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const rootDir = fileURLToPath(new URL(".", import.meta.url))

// Manually map the path aliases from tsconfig.json instead of using the
// vite-tsconfig-paths plugin (which is ESM-only and incompatible with the
// CJS config-loading path that older vitest/vite versions use).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "."),
      "server-only": path.resolve(rootDir, "vitest.mocks/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      "node_modules",
      "**/node_modules/**",
      ".next",
      "**/.next/**",
      "storybook-static",
      ".claude/worktrees/**",
    ],
  },
})
