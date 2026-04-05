import type { Meta, StoryObj } from "@storybook/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { WizardLayout } from "@/components/application/wizard-layout"
import { sampleWizardSteps } from "@/components/storybook/storybook-utils"

const meta = {
  title: "Application/WizardLayout",
  component: WizardLayout,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    padded: false,
  },
  args: {
    steps: sampleWizardSteps,
    currentStep: 2,
    title: "ACA-3 application",
    children: (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Household details</p>
            <p className="text-sm text-muted-foreground">
              Capture who lives with the applicant and who needs coverage before moving to income.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">Back</Button>
            <Button>Continue</Button>
          </div>
        </CardContent>
      </Card>
    ),
  },
} satisfies Meta<typeof WizardLayout>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NearCompletion: Story = {
  args: {
    currentStep: 4,
    steps: sampleWizardSteps.map((step, index) => ({
      ...step,
      completed: index < 3,
      current: index === 3,
    })),
    title: "Review and submit",
  },
}
