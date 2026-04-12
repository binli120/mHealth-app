/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import nextConfig from "eslint-config-next"

const config = [
  {
    ignores: [
      "**/.next/**",
      "coverage/**",
      "e2e/report/**",
      "storybook-static/**",
      ".claude/**",
      "debug-storybook.log",
    ],
  },
  ...nextConfig,
]

export default config
