/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { Meta, StoryObj } from "@storybook/nextjs"
import { PrivacyPromiseBlock } from "./privacy-promise-block"

const meta: Meta<typeof PrivacyPromiseBlock> = {
  title: "Privacy/PrivacyPromiseBlock",
  component: PrivacyPromiseBlock,
  parameters: {
    layout: "fullscreen",
  },
}
export default meta

type Story = StoryObj<typeof PrivacyPromiseBlock>

export const Light: Story = {
  parameters: { backgrounds: { default: "light" } },
}

export const Dark: Story = {
  parameters: {
    backgrounds: { default: "dark" },
    className: "dark",
  },
  decorators: [
    (Story) => (
      <div className="dark bg-background">
        <Story />
      </div>
    ),
  ],
}
