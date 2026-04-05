import type { Meta, StoryObj } from "@storybook/nextjs"
import { UserAvatar } from "@/components/shared/UserAvatar"

const meta = {
  title: "Shared/UserAvatar",
  component: UserAvatar,
  tags: ["autodocs"],
  args: {
    firstName: "Maria",
    lastName: "Santos",
    size: "md",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
    },
  },
} satisfies Meta<typeof UserAvatar>

export default meta

type Story = StoryObj<typeof meta>

export const Initials: Story = {}

export const WithPhoto: Story = {
  args: {
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
  },
}

export const FallbackIcon: Story = {
  args: {
    firstName: null,
    lastName: null,
    avatarUrl: null,
  },
}
