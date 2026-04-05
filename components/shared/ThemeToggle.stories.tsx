import type { Meta, StoryObj } from "@storybook/nextjs"
import { ThemeToggle } from "@/components/shared/ThemeToggle"

const meta = {
  title: "Shared/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
} satisfies Meta<typeof ThemeToggle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
