import type { Meta, StoryObj } from "@storybook/nextjs"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"

const meta = {
  title: "Shared/LoadingSkeleton",
  component: LoadingSkeleton,
  tags: ["autodocs"],
  args: {
    blocks: ["h-6 w-40", "h-24", "h-40", "h-32"],
    className: "max-w-2xl",
  },
} satisfies Meta<typeof LoadingSkeleton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CompactPanel: Story = {
  args: {
    blocks: ["h-5 w-28", "h-16", "h-16"],
    className: "max-w-md",
  },
}
