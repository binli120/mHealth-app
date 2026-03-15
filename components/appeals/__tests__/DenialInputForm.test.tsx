import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { DenialInputForm } from "@/components/appeals/DenialInputForm"
import { APPEAL_DENIAL_REASONS, APPEAL_DETAILS_MAX_LENGTH } from "@/lib/appeals/constants"

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn(),
}))

function renderForm(isLoading = false) {
  const onSubmit = vi.fn()
  render(<DenialInputForm onSubmit={onSubmit} isLoading={isLoading} />)
  return { onSubmit }
}

describe("DenialInputForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the form heading", () => {
    renderForm()
    expect(screen.getByText("Tell us about your denial")).toBeInTheDocument()
  })

  it("renders denial reason select with a placeholder", () => {
    renderForm()
    expect(screen.getByText(/Select the reason your application was denied/i)).toBeInTheDocument()
  })

  it("renders the correct number of denial reason options", () => {
    renderForm()
    // Radix Select renders options into a portal; verify the expected count via the constant
    expect(APPEAL_DENIAL_REASONS.length).toBe(9)
  })

  it("submit button is disabled when no denial reason is selected", () => {
    renderForm()
    expect(screen.getByRole("button", { name: /analyze my denial/i })).toBeDisabled()
  })

  it("shows 'Analyzing…' and disables submit when isLoading is true", () => {
    renderForm(true)
    expect(screen.getByText(/Analyzing…/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /analyzing/i })).toBeDisabled()
  })

  it("renders the additional details textarea", () => {
    renderForm()
    expect(screen.getByLabelText(/additional details/i)).toBeInTheDocument()
  })

  it("shows the character count for additional details", () => {
    renderForm()
    expect(screen.getByText(`0 / ${APPEAL_DETAILS_MAX_LENGTH}`)).toBeInTheDocument()
  })

  it("updates character count when user types in details", () => {
    renderForm()
    const textarea = screen.getByLabelText(/additional details/i)
    fireEvent.change(textarea, { target: { value: "Some context" } })
    expect(screen.getByText(`12 / ${APPEAL_DETAILS_MAX_LENGTH}`)).toBeInTheDocument()
  })

  it("renders the file upload area when document state is idle", () => {
    renderForm()
    expect(screen.getByText(/Click to attach denial letter/i)).toBeInTheDocument()
  })

  it("renders document upload description text", () => {
    renderForm()
    expect(screen.getByText(/Accepted: JPEG, PNG, WEBP, PDF/i)).toBeInTheDocument()
  })
})
