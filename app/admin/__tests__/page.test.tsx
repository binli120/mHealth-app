/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AdminDashboardPage from "@/app/admin/page"

const { mockAuthenticatedFetch } = vi.hoisted(() => ({
  mockAuthenticatedFetch: vi.fn(),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    mockAuthenticatedFetch.mockReset()
    mockAuthenticatedFetch.mockResolvedValue({
      json: async () => ({
        ok: true,
        stats: {
          totalUsers: 18,
          pendingSwApprovals: 2,
          totalCompanies: 7,
          pendingCompanies: 1,
        },
      }),
    })
  })

  it("loads admin stats and renders dashboard quick actions", async () => {
    render(<AdminDashboardPage />)

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument()
    expect(screen.getByText("Quick Actions")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("18")).toBeInTheDocument()
      expect(screen.getByText("2")).toBeInTheDocument()
      expect(screen.getByText("7")).toBeInTheDocument()
      expect(screen.getByText("1")).toBeInTheDocument()
    })

    expect(mockAuthenticatedFetch).toHaveBeenCalledWith("/api/admin/stats")
    expect(screen.getByRole("link", { name: /review pending social workers/i })).toHaveAttribute(
      "href",
      "/admin/social-workers?status=pending",
    )
    expect(screen.getByRole("link", { name: /manage all users/i })).toHaveAttribute("href", "/admin/users")
  })
})
