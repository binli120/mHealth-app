/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AdminSocialWorkersPage from "@/app/admin/social-workers/page"

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

describe("AdminSocialWorkersPage", () => {
  beforeEach(() => {
    mockAuthenticatedFetch.mockReset()
    mockUseSearchParams.mockReturnValue(new URLSearchParams("status=pending"))
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    mockAuthenticatedFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" || init?.method === "PATCH") {
        return { status: 200, json: async () => ({ ok: true, inviteUrl: "https://example.test/sw-invite" }) }
      }
      if (url.startsWith("/api/admin/users")) {
        return { json: async () => ({ companies: [{ id: "company-1", name: "Care Agency" }] }) }
      }
      return {
        json: async () => ({
          ok: true,
          total: 1,
          socialWorkers: [
            {
              id: "profile-1",
              email: "worker@example.com",
              first_name: "Sam",
              last_name: "Social",
              company_name: "Care Agency",
              license_number: "LIC-123",
              job_title: "LCSW",
              status: "pending",
              rejection_note: null,
              created_at: "2026-06-09T12:00:00Z",
            },
          ],
        }),
      }
    })
  })

  it("initializes from the status query and renders social workers", async () => {
    render(<AdminSocialWorkersPage />)

    expect(await screen.findByText("Sam Social")).toBeInTheDocument()
    expect(screen.getByText("worker@example.com")).toBeInTheDocument()
    expect(screen.getByText("Care Agency")).toBeInTheDocument()
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      "/api/admin/social-workers?status=pending&limit=25&offset=0",
    )
  })

  it("approves a pending social worker", async () => {
    render(<AdminSocialWorkersPage />)

    fireEvent.click(await screen.findByTitle("Approve"))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/social-workers",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ profileId: "profile-1", action: "approve" }),
        }),
      )
    })
  })

  it("rejects a social worker with an optional note", async () => {
    render(<AdminSocialWorkersPage />)

    fireEvent.click(await screen.findByTitle("Reject"))
    fireEvent.change(screen.getByPlaceholderText(/reason for rejection/i), {
      target: { value: "License expired" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: /^reject$/i }).at(-1)!)

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/social-workers",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            profileId: "profile-1",
            action: "reject",
            rejectionNote: "License expired",
          }),
        }),
      )
    })
  })

  it("sends a social worker invitation", async () => {
    render(<AdminSocialWorkersPage />)

    fireEvent.click(await screen.findByRole("button", { name: /invite social worker/i }))
    fireEvent.change(screen.getByPlaceholderText("socialworker@agency.org"), {
      target: { value: "invitee@agency.org" },
    })
    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/users/invite",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "invitee@agency.org",
            companyId: null,
            role: "social_worker",
          }),
        }),
      )
    })
    expect(await screen.findByText("https://example.test/sw-invite")).toBeInTheDocument()
  })

  it("copies a generated social worker invite link", async () => {
    render(<AdminSocialWorkersPage />)

    fireEvent.click(await screen.findByRole("button", { name: /invite social worker/i }))
    fireEvent.change(screen.getByPlaceholderText("socialworker@agency.org"), {
      target: { value: "invitee@agency.org" },
    })
    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }))
    fireEvent.click(await screen.findByRole("button", { name: /copy/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://example.test/sw-invite")
  })
})
