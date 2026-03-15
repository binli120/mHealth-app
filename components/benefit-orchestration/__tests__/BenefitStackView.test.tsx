import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { BenefitStackView } from "@/components/benefit-orchestration/BenefitStackView"
import type { BenefitStack, BenefitResult } from "@/lib/benefit-orchestration/types"

function makeResult(overrides: Partial<BenefitResult> = {}): BenefitResult {
  return {
    programId: "snap",
    programName: "SNAP",
    programShortName: "SNAP",
    category: "food",
    administeredBy: "DTA",
    eligibilityStatus: "likely",
    estimatedMonthlyValue: 450,
    estimatedAnnualValue: 5400,
    valueNote: "Estimated",
    processingTime: "30 days",
    keyRequirements: ["MA resident"],
    requiredDocuments: ["Proof of income"],
    nextSteps: ["Apply online"],
    applicationUrl: "https://dtaconnect.eohhs.mass.gov",
    applicationPhone: undefined,
    applicationNote: undefined,
    waitlistWarning: undefined,
    ...overrides,
  }
}

const snapResult = makeResult()
const massHealthResult = makeResult({
  programId: "masshealth",
  programName: "MassHealth",
  programShortName: "MassHealth",
  category: "healthcare",
  eligibilityStatus: "possibly",
  estimatedMonthlyValue: 0,
  estimatedAnnualValue: 0,
})

const stack: BenefitStack = {
  householdSize: 3,
  fplPercent: 145,
  totalEstimatedMonthlyValue: 450,
  totalEstimatedAnnualValue: 5400,
  summary: "Your household likely qualifies for SNAP.",
  results: [snapResult, massHealthResult],
  likelyPrograms: [snapResult],
  possiblePrograms: [massHealthResult],
  quickWins: [snapResult],
  bundles: [],
}

describe("BenefitStackView", () => {
  it("renders the summary banner with monthly value", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    // $450 appears in the banner and inside program cards — just assert at least one match
    expect(screen.getAllByText(/\$450/).length).toBeGreaterThanOrEqual(1)
  })

  it("renders household size and FPL percent in banner", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    expect(screen.getByText("Household of 3")).toBeInTheDocument()
    expect(screen.getByText("145% FPL")).toBeInTheDocument()
  })

  it("renders the stack summary text", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    expect(screen.getByText("Your household likely qualifies for SNAP.")).toBeInTheDocument()
  })

  it("shows likely programs count chip", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    expect(screen.getByText(/1 programs you likely qualify for/i)).toBeInTheDocument()
  })

  it("shows possible programs count chip", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    expect(screen.getByText(/1 programs to explore/i)).toBeInTheDocument()
  })

  it("renders the Quick Wins section", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    expect(screen.getByText("Start Here — Quick Wins")).toBeInTheDocument()
  })

  it("renders the Likely Eligible section", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    expect(screen.getByText(/Likely Eligible \(1\)/)).toBeInTheDocument()
  })

  it("renders the May Qualify section", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    expect(screen.getByText(/May Qualify.*Exploring/i)).toBeInTheDocument()
  })

  it("renders the total programs evaluated count", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    expect(screen.getByText(`${stack.results.length} programs evaluated`)).toBeInTheDocument()
  })

  it("renders the disclaimer", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    expect(screen.getByText(/these results are estimates/i)).toBeInTheDocument()
  })

  it("calls onUpdateProfile when Update my information is clicked", () => {
    const onUpdateProfile = vi.fn()
    render(<BenefitStackView stack={stack} onUpdateProfile={onUpdateProfile} />)
    fireEvent.click(screen.getByRole("button", { name: /update my information/i }))
    expect(onUpdateProfile).toHaveBeenCalledOnce()
  })

  it("shows 'Benefits analysis complete' when total value is 0", () => {
    const zeroStack = { ...stack, totalEstimatedMonthlyValue: 0, totalEstimatedAnnualValue: 0 }
    render(<BenefitStackView stack={zeroStack} onUpdateProfile={vi.fn()} />)
    expect(screen.getByText("Benefits analysis complete")).toBeInTheDocument()
  })

  it("does not render bundles section when bundles array is empty", () => {
    render(<BenefitStackView stack={stack} onUpdateProfile={vi.fn()} />)
    expect(screen.queryByText("Apply Together & Save Time")).not.toBeInTheDocument()
  })
})
