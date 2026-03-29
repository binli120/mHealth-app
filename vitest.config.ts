import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // 'server-only' is a Next.js compile-time guard with no runtime behaviour.
      // Map it to an empty stub so route-handler and lib tests can import server
      // modules without throwing.
      'server-only': path.resolve(__dirname, '__mocks__/server-only.ts'),
    },
  },
  test: {
    // jsdom covers all component / hook tests; pure-function tests run fine
    // under jsdom too, so a single global environment is sufficient.
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        // jsdom requires a URL to enable localStorage / sessionStorage.
        url: 'http://localhost/',
      },
    },
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.claude/**',
      'e2e/**',
    ],
  },
})
