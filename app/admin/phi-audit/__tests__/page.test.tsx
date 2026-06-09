/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import PhiAuditPage from "@/app/admin/phi-audit/page"

const { mockAuthenticatedFetch } = vi.hoisted(() => ({
  mockAuthenticatedFetch: vi.fn(),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

describe("PhiAuditPage", () => {
  beforeEach(() => {
    mockAuthenticatedFetch.mockReset()
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 2,
        entries: [
          {
            id: "audit-1",
            action: "phi.ssn.decrypted",
            userId: "user-alpha-123456",
            ipAddress: "127.0.0.1",
            metadata: { purpose: "Eligibility review", field: "ssn" },
            createdAt: "2026-06-09T12:00:00Z",
          },
          {
            id: "audit-2",
            action: "phi.bank_account.written",
            userId: "user-beta-123456",
            ipAddress: null,
            metadata: { purpose: "Application update" },
            createdAt: "2026-06-08T12:00:00Z",
          },
        ],
      }),
    })
  })

  it("loads PHI audit entries and filters read/write events client-side", async () => {
    render(<PhiAuditPage />)

    expect(await screen.findByText("PHI Audit Log")).toBeInTheDocument()
    expect(screen.getByText("SSN Read")).toBeInTheDocument()
    expect(screen.getByText("Bank Account Written")).toBeInTheDocument()
    expect(screen.getAllByText("2").length).toBeGreaterThan(0)

    fireEvent.change(screen.getByDisplayValue("All events"), { target: { value: "reads" } })
    expect(screen.getByText("SSN Read")).toBeInTheDocument()
    expect(screen.queryByText("Bank Account Written")).not.toBeInTheDocument()
  })

  it("applies a user id filter to the API query", async () => {
    render(<PhiAuditPage />)

    fireEvent.change(await screen.findByPlaceholderText(/search by user id/i), {
      target: { value: "user-alpha" },
    })
    fireEvent.click(screen.getByRole("button", { name: /apply/i }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/phi-audit?limit=50&offset=0&userId=user-alpha",
      )
    })
  })
})
