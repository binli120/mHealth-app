import type { Meta, StoryObj } from "@storybook/nextjs"
import { ConversationBubble } from "@/components/shared/ConversationBubble"

const meta = {
  title: "Shared/ConversationBubble",
  component: ConversationBubble,
  tags: ["autodocs"],
  args: {
    align: "start",
    tone: "secondary",
    children: "You may qualify for both coverage and food assistance based on the information shared so far.",
  },
  argTypes: {
    align: {
      control: "inline-radio",
      options: ["start", "end"],
    },
    tone: {
      control: "inline-radio",
      options: ["primary", "secondary"],
    },
  },
} satisfies Meta<typeof ConversationBubble>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const TwoWayConversation: Story = {
  render: () => (
    <div className="max-w-2xl space-y-3">
      <ConversationBubble align="start" tone="secondary">
        Tell me what changed in your household since the last renewal.
      </ConversationBubble>
      <ConversationBubble
        align="end"
        tone="primary"
        footer={<p className="text-xs opacity-80">Submitted just now</p>}
      >
        My income dropped after my hours were cut, and my daughter moved back in.
      </ConversationBubble>
    </div>
  ),
}
