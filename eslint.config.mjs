/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import nextConfig from "eslint-config-next"

const config = [
  {
    ignores: ["**/.next/**", "storybook-static/**", ".claude/**", "debug-storybook.log"],
  },
  ...nextConfig,
]

export default config
