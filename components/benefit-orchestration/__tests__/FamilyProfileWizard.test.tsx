/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { FamilyProfileWizard } from "@/components/benefit-orchestration/FamilyProfileWizard"

vi.mock("@/lib/redux/hooks", () => ({
  useAppSelector: (selector: (state: { app: { language: "en" } }) => unknown) =>
    selector({ app: { language: "en" } }),
}))

vi.mock("@/lib/supabase/client", () => ({
  getSafeSupabaseSession: vi.fn().mockResolvedValue({ session: null }),
}))

function renderWizard(props: Partial<Parameters<typeof FamilyProfileWizard>[0]> = {}) {
  return render(
    <FamilyProfileWizard onComplete={vi.fn()} {...props} />,
  )
}

describe("FamilyProfileWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders without crashing", () => {
    const { container } = renderWizard()
    expect(container.firstChild).toBeTruthy()
  })

  it("starts on step 1 — About You", () => {
    renderWizard()
    expect(screen.getByText("Tell us about yourself")).toBeInTheDocument()
  })

  it("renders step tabs for all 6 steps", () => {
    renderWizard()
    // Tabs now have role="tab" (not "button") — part of the accessible tablist
    const stepLabels = ["About You", "Household", "Your Income", "Housing", "Assets", "Review"]
    for (const label of stepLabels) {
      expect(screen.getByRole("tab", { name: new RegExp(label, "i") })).toBeInTheDocument()
    }
  })

  it("renders a progress bar", () => {
    renderWizard()
    // "Step 1 of 6" appears in both the visible label and the sr-only live region;
    // use getAllByText and verify at least one element is in the document.
    expect(screen.getAllByText(/Step 1 of 6/i).length).toBeGreaterThan(0)
  })

  it("renders the date of birth picker on step 0", () => {
    renderWizard()
    // DobInput renders a text input associated with the "Date of birth" label
    expect(screen.getByRole("textbox", { name: /date of birth/i })).toBeInTheDocument()
  })

  it("renders citizenship status select on step 0", () => {
    renderWizard()
    expect(screen.getByText(/US Citizen or US National/i)).toBeInTheDocument()
  })

  it("Back button is disabled on the first step", () => {
    renderWizard()
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled()
  })

  it("advances to the Household step when Next is clicked", () => {
    renderWizard()
    fireEvent.click(screen.getByRole("button", { name: /next/i }))
    expect(screen.getByText("Who else lives in your household?")).toBeInTheDocument()
  })

  it("renders 'Add household member' button on Household step", () => {
    renderWizard()
    fireEvent.click(screen.getByRole("button", { name: /next/i }))
    expect(screen.getByRole("button", { name: /add household member/i })).toBeInTheDocument()
  })

  it("adds a household member card when Add button is clicked", () => {
    renderWizard()
    fireEvent.click(screen.getByRole("button", { name: /next/i }))
    const addBtn = screen.getByRole("button", { name: /add household member/i })
    fireEvent.click(addBtn)
    // After adding a member, the add button should still be present (can add more)
    // and at least one Name input for the new member appears
    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument()
  })

  it("navigates directly to a step when a step tab is clicked", () => {
    renderWizard()
    // Tabs now have role="tab"
    fireEvent.click(screen.getByRole("tab", { name: /housing/i }))
    expect(screen.getByText(/Housing & utilities/i)).toBeInTheDocument()
  })

  it("renders the Review step with a submit button", () => {
    renderWizard()
    fireEvent.click(screen.getByRole("tab", { name: /review/i }))
    expect(screen.getByRole("button", { name: /see my benefits stack/i })).toBeInTheDocument()
  })

  it("shows loading state when loading prop is true", () => {
    renderWizard({ loading: true })
    // Navigate to review step via tab
    fireEvent.click(screen.getByRole("tab", { name: /review/i }))
    expect(screen.getByRole("button", { name: /see my benefits stack/i })).toBeDisabled()
  })
})
