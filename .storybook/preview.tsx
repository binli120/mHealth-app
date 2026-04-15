/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import type { Preview } from "@storybook/nextjs"

import "../app/globals.css"
import { StorybookProviders } from "@/components/storybook/storybook-utils"

const preview: Preview = {
  decorators: [
    (Story, context) => (
      <StorybookProviders
        appState={context.parameters.appState}
        padded={context.parameters.padded !== false}
      >
        <Story />
      </StorybookProviders>
    ),
  ],
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
