/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { WizardLayout } from "@/components/application/wizard-layout"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/lib/icons", () => ({
  ShieldHeartIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="shield-heart-icon" />
  ),
}))

const steps = [
  { id: "step-1", title: "Personal Information", shortTitle: "Personal", completed: true, current: false },
  { id: "step-2", title: "Household", shortTitle: "Household", completed: false, current: true },
  { id: "step-3", title: "Income", shortTitle: "Income", completed: false, current: false },
]

function renderLayout(overrides: Partial<Parameters<typeof WizardLayout>[0]> = {}) {
  return render(
    <WizardLayout steps={steps} currentStep={2} title="ACA-3 Application" {...overrides}>
      <div>Step content here</div>
    </WizardLayout>,
  )
}

describe("WizardLayout", () => {
  it("renders children", () => {
    renderLayout()
    expect(screen.getByText("Step content here")).toBeInTheDocument()
  })

  it("renders the MassHealth branding", () => {
    renderLayout()
    expect(screen.getByText("MassHealth")).toBeInTheDocument()
  })

  it("renders the step counter text", () => {
    renderLayout()
    expect(screen.getByText(`Step 2 of ${steps.length}`)).toBeInTheDocument()
  })

  it("renders the title in the progress summary", () => {
    renderLayout()
    expect(screen.getByText("ACA-3 Application")).toBeInTheDocument()
  })

  it("shows the correct completion percentage", () => {
    renderLayout({ currentStep: 2 })
    const expectedPct = Math.round((2 / steps.length) * 100)
    expect(screen.getByText(`${expectedPct}% complete`)).toBeInTheDocument()
  })

  it("renders a Save & Exit link", () => {
    renderLayout()
    expect(screen.getByRole("link", { name: /save & exit/i })).toBeInTheDocument()
  })

  it("renders all step labels in the desktop step bar", () => {
    renderLayout()
    // Each step title should appear at least once
    for (const step of steps) {
      expect(screen.getAllByText(step.shortTitle ?? step.title).length).toBeGreaterThan(0)
    }
  })
})
