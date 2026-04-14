/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import nextConfig from "eslint-config-next"

const config = [
  {
    ignores: [
      "**/.next/**",
      "coverage/**",
      "storybook-static/**",
      ".claude/**",
      "debug-storybook.log",
      // Playwright-generated trace bundles — minified third-party code
      "e2e/report/**",
      "playwright-report/**",
    ],
  },
  ...nextConfig,
]

export default config
