import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { BenefitProgramCard } from "@/components/benefit-orchestration/BenefitProgramCard"
import type { BenefitResult } from "@/lib/benefit-orchestration/types"

const baseResult: BenefitResult = {
  programId: "snap",
  programName: "SNAP (Food Stamps)",
  programShortName: "SNAP",
  category: "food",
  administeredBy: "DTA",
  eligibilityStatus: "likely",
  estimatedMonthlyValue: 450,
  estimatedAnnualValue: 5400,
  valueNote: "Based on household of 3",
  processingTime: "30 days",
  keyRequirements: ["MA resident", "Income below 130% FPL"],
  requiredDocuments: ["Proof of income", "Photo ID"],
  nextSteps: ["Visit dta.state.ma.us", "Complete online application"],
  applicationUrl: "https://dtaconnect.eohhs.mass.gov",
  applicationPhone: "877-382-2363",
  applicationNote: "Apply online or by phone.",
  waitlistWarning: undefined,
}

function renderCard(overrides: Partial<BenefitResult> = {}, props: { isQuickWin?: boolean; compact?: boolean } = {}) {
  return render(<BenefitProgramCard result={{ ...baseResult, ...overrides }} {...props} />)
}

describe("BenefitProgramCard", () => {
  it("renders the program name", () => {
    renderCard()
    expect(screen.getByText("SNAP (Food Stamps)")).toBeInTheDocument()
  })

  it("renders the eligibility status badge", () => {
    renderCard()
    expect(screen.getByText("Likely Eligible")).toBeInTheDocument()
  })

  it("renders 'May Qualify' badge for possibly status", () => {
    renderCard({ eligibilityStatus: "possibly" })
    expect(screen.getByText("May Qualify")).toBeInTheDocument()
  })

  it("renders 'Not Eligible' badge for ineligible status", () => {
    renderCard({ eligibilityStatus: "ineligible" })
    expect(screen.getByText("Not Eligible")).toBeInTheDocument()
  })

  it("renders the administeredBy and category", () => {
    renderCard()
    expect(screen.getByText(/DTA/)).toBeInTheDocument()
  })

  it("renders the estimated monthly value", () => {
    renderCard()
    expect(screen.getByText(/\$450/)).toBeInTheDocument()
  })

  it("does not render value section when estimatedMonthlyValue is 0", () => {
    renderCard({ estimatedMonthlyValue: 0 })
    expect(screen.queryByText(/\/month/)).not.toBeInTheDocument()
  })

  it("renders processing time", () => {
    renderCard()
    expect(screen.getByText("30 days")).toBeInTheDocument()
  })

  it("shows 'Quick Win' badge when isQuickWin is true", () => {
    renderCard({}, { isQuickWin: true })
    expect(screen.getByText(/quick win/i)).toBeInTheDocument()
  })

  it("does not show 'Quick Win' badge by default", () => {
    renderCard()
    expect(screen.queryByText(/quick win/i)).not.toBeInTheDocument()
  })

  it("shows the expand button in non-compact mode", () => {
    renderCard()
    expect(screen.getByRole("button", { name: /view requirements/i })).toBeInTheDocument()
  })

  it("expands to show key requirements on click", () => {
    renderCard()
    fireEvent.click(screen.getByRole("button", { name: /view requirements/i }))
    expect(screen.getByText("MA resident")).toBeInTheDocument()
    expect(screen.getByText("Income below 130% FPL")).toBeInTheDocument()
  })

  it("shows required documents after expanding", () => {
    renderCard()
    fireEvent.click(screen.getByRole("button", { name: /view requirements/i }))
    expect(screen.getByText("Proof of income")).toBeInTheDocument()
  })

  it("shows requirements directly in compact mode without needing to expand", () => {
    renderCard({}, { compact: true })
    expect(screen.getByText("MA resident")).toBeInTheDocument()
  })

  it("renders the Apply Now link when applicationUrl is provided", () => {
    renderCard()
    expect(screen.getByRole("link", { name: /apply now/i })).toHaveAttribute(
      "href",
      "https://dtaconnect.eohhs.mass.gov",
    )
  })

  it("renders the phone number link", () => {
    renderCard()
    const phoneLink = screen.getByRole("link", { name: /877-382-2363/i })
    expect(phoneLink).toHaveAttribute("href", "tel:8773822363")
  })

  it("renders the waitlist warning when provided", () => {
    renderCard({ waitlistWarning: "Long waitlist — apply early." })
    expect(screen.getByText("Long waitlist — apply early.")).toBeInTheDocument()
  })

  it("renders the application note", () => {
    renderCard()
    expect(screen.getByText("Apply online or by phone.")).toBeInTheDocument()
  })
})
