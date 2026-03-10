import nextConfig from "eslint-config-next"

const config = [
  {
    ignores: ["**/.next/**", "storybook-static/**", "debug-storybook.log"],
  },
  ...nextConfig,
]

export default config
