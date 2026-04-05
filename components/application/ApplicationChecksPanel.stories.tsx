import type { Meta, StoryObj } from "@storybook/nextjs"
import { ApplicationChecksPanel } from "@/components/application/ApplicationChecksPanel"
import { sampleApplicationChecks } from "@/components/storybook/storybook-utils"

const meta = {
  title: "Application/ApplicationChecksPanel",
  component: ApplicationChecksPanel,
  tags: ["autodocs"],
  args: {
    results: sampleApplicationChecks,
  },
} satisfies Meta<typeof ApplicationChecksPanel>

export default meta

type Story = StoryObj<typeof meta>

export const WithFindings: Story = {}

export const AllClear: Story = {
  args: {
    results: [],
  },
}
