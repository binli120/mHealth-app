/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AdminSessionsPage from "@/app/admin/sessions/page"

const { mockAuthenticatedFetch } = vi.hoisted(() => ({
  mockAuthenticatedFetch: vi.fn(),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

describe("AdminSessionsPage", () => {
  beforeEach(() => {
    mockAuthenticatedFetch.mockReset()
    vi.stubGlobal("confirm", vi.fn(() => true))
    mockAuthenticatedFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (!init) {
        return {
          json: async () => ({
            ok: true,
            settings: {
              session_timeout_minutes: "60",
              max_sessions_per_user: "5",
              require_2fa_admin: "false",
            },
            sessions: [
              {
                id: "session-1",
                user_id: "user-1",
                email: "caseworker@example.com",
                full_name: "Case Worker",
                event_type: "login",
                ip_address: "127.0.0.1",
                user_agent: "Mozilla Chrome",
                created_at: "2026-06-09T12:00:00Z",
              },
            ],
          }),
        }
      }

      return { json: async () => ({ ok: true }) }
    })
  })

  it("loads session policy and saves changed settings", async () => {
    render(<AdminSessionsPage />)

    expect(await screen.findByRole("heading", { name: "Session Management" })).toBeInTheDocument()
    expect(screen.getByText("Case Worker")).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue("60"), { target: { value: "90" } })
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenLastCalledWith(
        "/api/admin/sessions",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            action: "update_settings",
            settings: {
              session_timeout_minutes: "90",
              max_sessions_per_user: "5",
              require_2fa_admin: "false",
            },
          }),
        }),
      )
    })
    expect(await screen.findByText("Settings saved")).toBeInTheDocument()
  })

  it("force-signs out a user after confirmation", async () => {
    render(<AdminSessionsPage />)

    fireEvent.click(await screen.findByTitle("Force sign out"))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenLastCalledWith(
        "/api/admin/sessions",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "force_logout", userId: "user-1" }),
        }),
      )
    })
    expect(screen.getByText("User signed out")).toBeInTheDocument()
  })
})
