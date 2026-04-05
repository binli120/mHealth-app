import type { Meta, StoryObj } from "@storybook/nextjs"
import { BenefitProgramCard } from "@/components/benefit-orchestration/BenefitProgramCard"
import { makeBenefitResult } from "@/components/storybook/storybook-utils"

const meta = {
  title: "Benefit Orchestration/BenefitProgramCard",
  component: BenefitProgramCard,
  tags: ["autodocs"],
  args: {
    result: makeBenefitResult(),
  },
} satisfies Meta<typeof BenefitProgramCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const QuickWin: Story = {
  args: {
    isQuickWin: true,
  },
}

export const Compact: Story = {
  args: {
    compact: true,
    result: makeBenefitResult({
      programId: "masshealth_standard",
      programName: "MassHealth Standard",
      programShortName: "MassHealth",
      category: "healthcare",
      applicationUrl: "/application/new",
      applicationPhone: undefined,
      estimatedMonthlyValue: 0,
      estimatedAnnualValue: 0,
      valueNote: "Full medical coverage estimate instead of direct cash value.",
    }),
  },
}
