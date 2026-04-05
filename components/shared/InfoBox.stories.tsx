import type { Meta, StoryObj } from "@storybook/nextjs"
import { InfoBox } from "@/components/shared/InfoBox"

const meta = {
  title: "Shared/InfoBox",
  component: InfoBox,
  tags: ["autodocs"],
  args: {
    variant: "info",
    children: "Bring proof of current income and identity to avoid follow-up document requests.",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["info", "warning", "success", "error", "neutral"],
    },
  },
} satisfies Meta<typeof InfoBox>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Warning: Story = {
  args: {
    variant: "warning",
    children: "Estimated benefits can change after MassHealth verifies income, residency, and household composition.",
  },
}

export const Success: Story = {
  args: {
    variant: "success",
    children: "Your uploaded wage documents were processed and are ready for review.",
  },
}
