/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AdminUsersPage from "@/app/admin/users/page"

const { mockAuthenticatedFetch, mockUseSearchParams } = vi.hoisted(() => ({
  mockAuthenticatedFetch: vi.fn(),
  mockUseSearchParams: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: mockUseSearchParams,
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

describe("AdminUsersPage", () => {
  beforeEach(() => {
    mockAuthenticatedFetch.mockReset()
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    vi.stubGlobal("confirm", vi.fn(() => true))
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    mockAuthenticatedFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST" || init?.method === "PATCH") {
        return { status: 200, json: async () => ({ ok: true, inviteUrl: "https://example.test/invite", updated: 1 }) }
      }

      return {
        json: async () => ({
          ok: true,
          total: 1,
          companies: [{ id: "company-1", name: "Boston Care Partners" }],
          users: [
            {
              id: "user-1",
              email: "admin@example.com",
              first_name: "Ada",
              last_name: "Admin",
              roles: ["admin"],
              is_active: true,
              company_name: "Boston Care Partners",
              created_at: "2026-06-09T12:00:00Z",
            },
          ],
        }),
      }
    })
  })

  it("loads users and renders roles, status, and company filters", async () => {
    render(<AdminUsersPage />)

    expect(await screen.findByText("Ada Admin")).toBeInTheDocument()
    expect(screen.getByText("admin@example.com")).toBeInTheDocument()
    expect(screen.getAllByText("Boston Care Partners").length).toBeGreaterThan(0)
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith("/api/admin/users?limit=25&offset=0&companies=1")
  })

  it("sends an invite and shows the generated invite link", async () => {
    render(<AdminUsersPage />)

    fireEvent.click(await screen.findByRole("button", { name: /invite user/i }))
    fireEvent.change(screen.getByPlaceholderText("user@example.com"), { target: { value: "new@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/users/invite",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "new@example.com",
            companyId: null,
            role: "applicant",
          }),
        }),
      )
    })
    expect(await screen.findByText("https://example.test/invite")).toBeInTheDocument()
  })

  it("runs bulk deactivation for selected users", async () => {
    render(<AdminUsersPage />)

    expect(await screen.findByText("Ada Admin")).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("checkbox")[1])
    fireEvent.click(screen.getAllByRole("button", { name: /^deactivate$/i }).at(-1)!)

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/bulk",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "deactivate", userIds: ["user-1"] }),
        }),
      )
    })
  })

  it("resets MFA after confirmation", async () => {
    render(<AdminUsersPage />)

    fireEvent.click(await screen.findByTitle("Reset 2FA"))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/users",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ userId: "user-1", action: "reset_mfa" }),
        }),
      )
    })
  })

  it("toggles a user's active status from the row action", async () => {
    render(<AdminUsersPage />)

    fireEvent.click(await screen.findByTitle("Deactivate"))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/users",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ userId: "user-1", action: "set_active", isActive: false }),
        }),
      )
    })
  })

  it("assigns a role through bulk actions", async () => {
    render(<AdminUsersPage />)

    expect(await screen.findByText("Ada Admin")).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("checkbox")[1])
    fireEvent.click(screen.getByRole("button", { name: /assign role/i }))
    fireEvent.click(screen.getByRole("button", { name: "Reviewer" }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/bulk",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "set_role", userIds: ["user-1"], role: "reviewer" }),
        }),
      )
    })
  })

  it("copies a generated invite link", async () => {
    render(<AdminUsersPage />)

    fireEvent.click(await screen.findByRole("button", { name: /invite user/i }))
    fireEvent.change(screen.getByPlaceholderText("user@example.com"), { target: { value: "new@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }))
    fireEvent.click(await screen.findByRole("button", { name: /copy/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://example.test/invite")
  })
})
