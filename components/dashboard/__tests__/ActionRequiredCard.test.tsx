import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import { ActionRequiredCard } from "../ActionRequiredCard"
import type { ApplicationListRecord } from "@/lib/applications/types"

const NOW = new Date("2026-06-09T10:00:00Z")
beforeAll(() => { vi.useFakeTimers() })
beforeEach(() => { vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers() })

function makeApp(overrides: Partial<ApplicationListRecord> = {}): ApplicationListRecord {
  return {
    id: "app-1",
    status: "draft",
    applicationType: "aca3",
    draftStep: 2,
    lastSavedAt: new Date(NOW.getTime() - 10 * 86400_000).toISOString(),
    submittedAt: null,
    createdAt: new Date(NOW.getTime() - 10 * 86400_000).toISOString(),
    updatedAt: new Date(NOW.getTime() - 10 * 86400_000).toISOString(),
    applicantName: "Test User",
    householdSize: null,
    phiDraftLocked: false,
    needsCustomerReview: false,
    swLastModifiedAt: null,
    ...overrides,
  }
}

describe("ActionRequiredCard", () => {
  it("shows no-action message when list is empty and no deadlines", () => {
    render(<ActionRequiredCard applications={[]} now={NOW} language="en" />)
    expect(screen.getByText(/no actions required/i)).toBeInTheDocument()
  })

  it("shows RFI item for rfi_requested application", () => {
    render(
      <ActionRequiredCard
        applications={[makeApp({ status: "rfi_requested" })]}
        now={NOW}
        language="en"
      />,
    )
    expect(screen.getByText(/information requested/i)).toBeInTheDocument()
  })

  it("shows SW-review item when needsCustomerReview is true", () => {
    render(
      <ActionRequiredCard
        applications={[makeApp({ needsCustomerReview: true, swLastModifiedAt: NOW.toISOString() })]}
        now={NOW}
        language="en"
      />,
    )
    expect(screen.getByText(/social worker updated/i)).toBeInTheDocument()
  })

  it("shows stale-draft item when draft not touched in 14+ days", () => {
    const fifteenDaysAgo = new Date(NOW.getTime() - 15 * 86400_000).toISOString()
    render(
      <ActionRequiredCard
        applications={[makeApp({ lastSavedAt: fifteenDaysAgo, createdAt: fifteenDaysAgo })]}
        now={NOW}
        language="en"
      />,
    )
    expect(screen.getByText(/application started/i)).toBeInTheDocument()
  })

  it("does NOT show stale-draft item when draft touched 10 days ago", () => {
    render(<ActionRequiredCard applications={[makeApp()]} now={NOW} language="en" />)
    expect(screen.queryByText(/application started/i)).not.toBeInTheDocument()
  })

  it("always shows security placeholder rows", () => {
    render(<ActionRequiredCard applications={[]} now={NOW} language="en" />)
    expect(screen.getByText(/review active login sessions/i)).toBeInTheDocument()
    expect(screen.getByText(/verify recovery options/i)).toBeInTheDocument()
  })

  it("renders items in priority order: RFI before SW-review before stale", () => {
    const fifteenDaysAgo = new Date(NOW.getTime() - 15 * 86400_000).toISOString()
    render(
      <ActionRequiredCard
        applications={[
          makeApp({ id: "a1", status: "rfi_requested" }),
          makeApp({ id: "a2", needsCustomerReview: true }),
          makeApp({ id: "a3", lastSavedAt: fifteenDaysAgo, createdAt: fifteenDaysAgo }),
        ]}
        now={NOW}
        language="en"
      />,
    )
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent(/information requested/i)
    expect(items[1]).toHaveTextContent(/social worker updated/i)
    expect(items[2]).toHaveTextContent(/application started/i)
  })
})
