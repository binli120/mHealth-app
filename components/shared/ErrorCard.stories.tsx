import type { Meta, StoryObj } from "@storybook/nextjs"
import { ErrorCard } from "@/components/shared/ErrorCard"

const meta = {
  title: "Shared/ErrorCard",
  component: ErrorCard,
  tags: ["autodocs"],
  args: {
    title: "We could not load your case",
    message: "The underlying record is unavailable right now. Retry or come back once the data service is healthy.",
  },
} satisfies Meta<typeof ErrorCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithRetry: Story = {
  args: {
    onRetry: () => undefined,
    retryLabel: "Retry lookup",
  },
}
