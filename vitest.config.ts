import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

const rootDir = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.resolve(rootDir, "vitest.mocks/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules", "**/node_modules/**", ".next", "**/.next/**", "storybook-static", ".claude/worktrees/**"],
  },
})
