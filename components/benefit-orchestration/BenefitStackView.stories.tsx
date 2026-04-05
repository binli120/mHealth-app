import type { Meta, StoryObj } from "@storybook/nextjs"
import { BenefitStackView } from "@/components/benefit-orchestration/BenefitStackView"
import { sampleBenefitStack } from "@/components/storybook/storybook-utils"

const meta = {
  title: "Benefit Orchestration/BenefitStackView",
  component: BenefitStackView,
  tags: ["autodocs"],
  args: {
    stack: sampleBenefitStack,
    onUpdateProfile: () => undefined,
  },
} satisfies Meta<typeof BenefitStackView>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AnalysisOnly: Story = {
  args: {
    stack: {
      ...sampleBenefitStack,
      totalEstimatedMonthlyValue: 0,
      totalEstimatedAnnualValue: 0,
      bundles: [],
      quickWins: [],
      summary: "No direct-value estimate is available yet, but the results still show the most relevant programs to review next.",
    },
  },
}
