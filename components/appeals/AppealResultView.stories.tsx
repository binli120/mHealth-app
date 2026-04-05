import type { Meta, StoryObj } from "@storybook/nextjs"
import { AppealResultView } from "@/components/appeals/AppealResultView"
import { sampleAppealAnalysis } from "@/components/storybook/storybook-utils"

const meta = {
  title: "Appeals/AppealResultView",
  component: AppealResultView,
  tags: ["autodocs"],
  args: {
    analysis: sampleAppealAnalysis,
    denialReasonLabel: "Income exceeds eligibility limit",
    onReset: () => undefined,
  },
} satisfies Meta<typeof AppealResultView>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoGeneratedLetter: Story = {
  args: {
    analysis: {
      ...sampleAppealAnalysis,
      appealLetter: "",
    },
  },
}
