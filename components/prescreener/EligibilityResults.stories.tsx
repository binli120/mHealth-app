import type { Meta, StoryObj } from "@storybook/nextjs"
import { ChatBubble, FPLReferenceTable, ResultsPanel } from "@/components/prescreener/EligibilityResults"
import { sampleEligibilityReport, sampleScreenerData } from "@/components/storybook/storybook-utils"

const meta = {
  title: "Prescreener/EligibilityResults",
  component: ResultsPanel,
  tags: ["autodocs"],
  args: {
    report: sampleEligibilityReport,
    screenerData: sampleScreenerData,
    onReset: () => undefined,
    language: "en",
  },
} satisfies Meta<typeof ResultsPanel>

export default meta

type Story = StoryObj<typeof meta>

export const ResultsSummary: Story = {}

export const Conversation: Story = {
  render: () => (
    <div className="max-w-2xl space-y-3">
      <ChatBubble
        message={{
          id: "message-1",
          role: "bot",
          text: "Tell me your household size so I can compare your income against the current FPL thresholds.",
          timestamp: new Date("2026-04-04T13:00:00.000Z"),
        }}
      />
      <ChatBubble
        message={{
          id: "message-2",
          role: "user",
          text: "Three people in the home and about $36,000 a year.",
          timestamp: new Date("2026-04-04T13:01:00.000Z"),
        }}
      />
    </div>
  ),
}

export const ReferenceTable: Story = {
  render: () => <FPLReferenceTable householdSize={3} fplPct={139} language="en" />,
}
