import nextConfig from "eslint-config-next"

const config = [
  {
    ignores: ["storybook-static/**", "debug-storybook.log"],
  },
  ...nextConfig,
]

export default config
