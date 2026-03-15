import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { AppealResultView } from "@/components/appeals/AppealResultView"
import type { AppealAnalysis } from "@/lib/appeals/types"

const baseAnalysis: AppealAnalysis = {
  explanation: "Your income was calculated incorrectly by the agency.",
  appealLetter: "Dear MassHealth,\n\nI am writing to appeal my denial...",
  evidenceChecklist: ["Pay stubs from the last 3 months", "Employer letter confirming salary"],
}

function renderView(overrides: Partial<AppealAnalysis> = {}, label = "Income exceeds eligibility limit") {
  const onReset = vi.fn()
  render(
    <AppealResultView
      analysis={{ ...baseAnalysis, ...overrides }}
      denialReasonLabel={label}
      onReset={onReset}
    />,
  )
  return { onReset }
}

describe("AppealResultView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the success banner with the denial reason label", () => {
    renderView()
    expect(screen.getByText("Appeal analysis complete")).toBeInTheDocument()
    expect(screen.getByText(/Income exceeds eligibility limit/)).toBeInTheDocument()
  })

  it("renders the explanation text", () => {
    renderView()
    expect(screen.getByText(baseAnalysis.explanation)).toBeInTheDocument()
  })

  it("renders the appeal letter content", () => {
    renderView()
    expect(screen.getByText(/I am writing to appeal my denial/)).toBeInTheDocument()
  })

  it("renders fallback text when appeal letter is empty", () => {
    renderView({ appealLetter: "" })
    expect(screen.getByText(/Appeal letter could not be generated/)).toBeInTheDocument()
  })

  it("renders the evidence checklist items", () => {
    renderView()
    expect(screen.getByText("Pay stubs from the last 3 months")).toBeInTheDocument()
    expect(screen.getByText("Employer letter confirming salary")).toBeInTheDocument()
  })

  it("does not render evidence section when checklist is empty", () => {
    renderView({ evidenceChecklist: [] })
    expect(screen.queryByText("Evidence to Gather")).not.toBeInTheDocument()
  })

  it("calls onReset when Start Over button is clicked", () => {
    const { onReset } = renderView()
    fireEvent.click(screen.getByRole("button", { name: /start over/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it("renders a Copy Letter button", () => {
    renderView()
    expect(screen.getByRole("button", { name: /copy letter/i })).toBeInTheDocument()
  })

  it("shows 'Copied!' feedback after clicking the copy button", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    renderView()
    fireEvent.click(screen.getByRole("button", { name: /copy letter/i }))
    expect(await screen.findByText("Copied!")).toBeInTheDocument()
  })

  it("renders checklist checkboxes with aria-labels for each evidence item", () => {
    renderView()
    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes).toHaveLength(baseAnalysis.evidenceChecklist.length)
    expect(checkboxes[0]).toHaveAttribute("aria-label", baseAnalysis.evidenceChecklist[0])
  })
})
