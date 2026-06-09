/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AdminCompaniesPage from "@/app/admin/companies/page"

const { mockAuthenticatedFetch, mockPush } = vi.hoisted(() => ({
  mockAuthenticatedFetch: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

describe("AdminCompaniesPage", () => {
  beforeEach(() => {
    mockAuthenticatedFetch.mockReset()
    mockPush.mockReset()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          results: [
            {
              name: "Cambridge Health",
              npi: "9876543210",
              address: "1 Main St",
              city: "Cambridge",
              state: "MA",
              zip: "02139",
              phone: "555-0100",
              email_domain: "cambridgehealth.org",
            },
          ],
        }),
      })),
    )
    mockAuthenticatedFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return { json: async () => ({ ok: true }) }
      return {
        json: async () => ({
          ok: true,
          total: 1,
          companies: [
            {
              id: "company-1",
              name: "Boston Care Partners",
              npi: "1234567890",
              city: "Boston",
              state: "MA",
              email_domain: "bostoncare.org",
              status: "pending",
              sw_count: 3,
            },
          ],
        }),
      }
    })
  })

  it("loads companies and links to company-scoped users", async () => {
    render(<AdminCompaniesPage />)

    expect(await screen.findByText("Boston Care Partners")).toBeInTheDocument()
    expect(screen.getByText("bostoncare.org")).toBeInTheDocument()
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith("/api/admin/companies?limit=25&offset=0")

    fireEvent.click(screen.getByTitle("View members"))
    expect(mockPush).toHaveBeenCalledWith("/admin/users?company_id=company-1")
  })

  it("approves a pending company", async () => {
    render(<AdminCompaniesPage />)

    fireEvent.click(await screen.findByTitle("Approve"))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/companies",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ companyId: "company-1", action: "approve" }),
        }),
      )
    })
  })

  it("updates a company email domain", async () => {
    render(<AdminCompaniesPage />)

    fireEvent.click(await screen.findByText("bostoncare.org"))
    fireEvent.change(screen.getByDisplayValue("bostoncare.org"), {
      target: { value: "partners.example" },
    })
    fireEvent.click(screen.getByText("Save"))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/companies",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            companyId: "company-1",
            action: "set_email_domain",
            emailDomain: "partners.example",
          }),
        }),
      )
    })
  })

  it("searches NPPES and adds a selected organization", async () => {
    render(<AdminCompaniesPage />)

    fireEvent.click(screen.getByRole("button", { name: /add from npi registry/i }))
    fireEvent.change(screen.getByPlaceholderText(/organization name/i), {
      target: { value: "Cambridge" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }))

    expect(await screen.findByText("Cambridge Health")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/companies",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Cambridge Health"),
        }),
      )
    })
  })
})
