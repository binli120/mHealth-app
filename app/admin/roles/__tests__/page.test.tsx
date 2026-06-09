/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AdminRolesPage from "@/app/admin/roles/page"

const { mockAuthenticatedFetch } = vi.hoisted(() => ({
  mockAuthenticatedFetch: vi.fn(),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

describe("AdminRolesPage", () => {
  beforeEach(() => {
    mockAuthenticatedFetch.mockReset()
    vi.stubGlobal("confirm", vi.fn(() => true))
    mockAuthenticatedFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method) return { json: async () => ({ ok: true }) }
      return {
        json: async () => ({
          ok: true,
          roles: [
            {
              name: "case_manager",
              description: "Manages applicant cases",
              color: "#2563eb",
              is_system: false,
              user_count: 2,
              permissions: ["applications:read"],
            },
            {
              name: "admin",
              description: "Platform administrator",
              color: "#dc2626",
              is_system: true,
              user_count: 1,
              permissions: ["applications:read", "applications:write"],
            },
          ],
        }),
      }
    })
  })

  it("loads roles and shows the selected permission matrix", async () => {
    render(<AdminRolesPage />)

    expect(await screen.findByRole("heading", { name: "Role & Permission Manager" })).toBeInTheDocument()
    expect(screen.getAllByText("case manager").length).toBeGreaterThan(0)
    expect(screen.getByText("Manages applicant cases")).toBeInTheDocument()
    expect(screen.getByText("1 perms")).toBeInTheDocument()
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith("/api/admin/roles")
  })

  it("creates a custom role with sanitized role name input", async () => {
    render(<AdminRolesPage />)

    fireEvent.click(await screen.findByRole("button", { name: /new role/i }))
    fireEvent.change(screen.getByPlaceholderText("e.g. billing_staff"), { target: { value: "Billing Staff 123" } })
    fireEvent.change(screen.getByPlaceholderText("Short description…"), { target: { value: "Handles billing cases" } })
    fireEvent.click(screen.getByRole("button", { name: /create role/i }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/roles",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "create",
            name: "billingstaff",
            description: "Handles billing cases",
            color: "#6b7280",
            permissions: [],
          }),
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getAllByText("billingstaff").length).toBeGreaterThan(0)
    })
  })

  it("saves changed permissions for the selected role", async () => {
    render(<AdminRolesPage />)

    const uncheckedPermission = await screen.findAllByRole("checkbox")
    fireEvent.click(uncheckedPermission.find((input) => !(input as HTMLInputElement).checked)!)
    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/roles",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"action":"update_permissions"'),
        }),
      )
    })
  })

  it("deletes a custom role after confirmation", async () => {
    render(<AdminRolesPage />)

    fireEvent.click(await screen.findByRole("button", { name: /delete/i }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/roles",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "delete", roleName: "case_manager" }),
        }),
      )
    })
  })
})
