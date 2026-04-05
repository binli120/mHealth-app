import type { Meta, StoryObj } from "@storybook/nextjs"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/PageHeader"

const meta = {
  title: "Shared/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    padded: false,
  },
  args: {
    backHref: "/customer/dashboard",
    backLabel: "Dashboard",
    breadcrumbs: [
      { label: "Tools", href: "/tools" },
      { label: "Benefit stack" },
    ],
  },
  argTypes: {
    actions: { control: false },
  },
} satisfies Meta<typeof PageHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAction: Story = {
  args: {
    actions: <Button size="sm">Reset profile</Button>,
  },
}
