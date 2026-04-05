import type { Meta, StoryObj } from "@storybook/nextjs"
import { Heart, Scale } from "lucide-react"
import { PageIntro } from "@/components/shared/PageIntro"

const meta = {
  title: "Shared/PageIntro",
  component: PageIntro,
  tags: ["autodocs"],
  args: {
    icon: <Heart className="h-6 w-6 text-blue-700" />,
    title: "Benefit stack analysis",
    description: "See which Massachusetts programs your household may be able to combine into a single action plan.",
    iconBg: "bg-blue-100",
  },
} satisfies Meta<typeof PageIntro>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AppealsTone: Story = {
  args: {
    icon: <Scale className="h-6 w-6 text-amber-700" />,
    title: "Appeal assistant",
    description: "Turn a denial notice into a clearer explanation, evidence checklist, and draft appeal letter.",
    iconBg: "bg-amber-100",
  },
}
