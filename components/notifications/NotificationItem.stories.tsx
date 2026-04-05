import type { Meta, StoryObj } from "@storybook/nextjs"
import { NotificationItem } from "@/components/notifications/NotificationItem"
import { makeNotification } from "@/components/storybook/storybook-utils"

const meta = {
  title: "Notifications/NotificationItem",
  component: NotificationItem,
  tags: ["autodocs"],
  args: {
    notification: makeNotification(),
  },
} satisfies Meta<typeof NotificationItem>

export default meta

type Story = StoryObj<typeof meta>

export const Unread: Story = {}

export const Read: Story = {
  args: {
    notification: makeNotification({
      readAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    }),
  },
}

export const DirectMessage: Story = {
  args: {
    notification: makeNotification({
      type: "new_direct_message",
      title: "New message from your social worker",
      body: "I can review your renewal packet this afternoon if you upload the last pay stub.",
      metadata: { senderUserId: "sw-7", senderName: "Nadia Flores" },
    }),
  },
}
