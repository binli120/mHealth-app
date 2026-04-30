/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AdminLayout from "@/app/admin/layout"

const {
  mockAuthenticatedFetch,
  mockGetSafeSupabaseSession,
  mockReplace,
  mockSignOut,
  mockUsePathname,
} = vi.hoisted(() => ({
  mockAuthenticatedFetch: vi.fn(),
  mockGetSafeSupabaseSession: vi.fn(),
  mockReplace: vi.fn(),
  mockSignOut: vi.fn(),
  mockUsePathname: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  useRouter: () => ({ replace: mockReplace }),
}))

vi.mock("@/lib/supabase/client", () => ({
  getSafeSupabaseSession: mockGetSafeSupabaseSession,
  getSupabaseClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

vi.mock("@/components/shared/IdleTimeoutGuard", () => ({
  IdleTimeoutGuard: () => <div data-testid="idle-timeout-guard" />,
}))

describe("AdminLayout", () => {
  beforeEach(() => {
    mockAuthenticatedFetch.mockReset()
    mockGetSafeSupabaseSession.mockReset()
    mockReplace.mockReset()
    mockSignOut.mockReset()
    mockUsePathname.mockReturnValue("/admin")

    mockGetSafeSupabaseSession.mockResolvedValue({
      session: { user: { email: "admin@example.com" } },
      error: null,
    })
    mockAuthenticatedFetch.mockResolvedValue({ status: 200 })
  })

  it("renders a full-height admin sidebar after admin auth is confirmed", async () => {
    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>,
    )

    const sidebar = await screen.findByRole("complementary", { name: /admin sidebar/i })

    expect(sidebar).toHaveClass("h-svh")
    expect(screen.getByText("HealthCompass MA")).toBeInTheDocument()
    expect(screen.getByText("Admin content")).toBeInTheDocument()
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith("/api/admin/stats")
  })

  it("hides and restores the desktop sidebar with the menu controls", async () => {
    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>,
    )

    const sidebar = await screen.findByRole("complementary", { name: /admin sidebar/i })

    fireEvent.click(screen.getByRole("button", { name: /hide admin sidebar/i }))

    await waitFor(() => {
      expect(sidebar).toHaveClass("lg:hidden")
    })

    fireEvent.click(screen.getByRole("button", { name: /open admin menu/i }))

    await waitFor(() => {
      expect(sidebar).not.toHaveClass("lg:hidden")
    })
  })

  it("redirects unauthenticated users to login", async () => {
    mockGetSafeSupabaseSession.mockResolvedValue({ session: null, error: null })

    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>,
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/auth/login?next=/admin")
    })
    expect(mockAuthenticatedFetch).not.toHaveBeenCalled()
  })
})
