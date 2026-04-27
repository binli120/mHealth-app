/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AuthGuard } from "@/components/shared/AuthGuard"

const mockReplace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockGetSession = vi.fn()
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}))

vi.mock("@/components/shared/IdleTimeoutGuard", () => ({
  IdleTimeoutGuard: () => <div data-testid="idle-timeout-guard" />,
}))

describe("AuthGuard", () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockGetSession.mockReset()
  })

  it("renders children and idle timeout guard after a valid session is confirmed", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } })

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    )

    await expect(screen.findByText("Protected content")).resolves.toBeInTheDocument()
    expect(screen.getByTestId("idle-timeout-guard")).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("does not render idle timeout guard when disabled for an authenticated surface", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } })

    render(
      <AuthGuard idleTimeout={false}>
        <div>Protected content</div>
      </AuthGuard>,
    )

    await expect(screen.findByText("Protected content")).resolves.toBeInTheDocument()
    expect(screen.queryByTestId("idle-timeout-guard")).not.toBeInTheDocument()
  })

  it("redirects unauthenticated users to login with the requested next path", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    render(
      <AuthGuard next="/customer/status">
        <div>Protected content</div>
      </AuthGuard>,
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/auth/login?next=%2Fcustomer%2Fstatus")
    })
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument()
    expect(screen.queryByTestId("idle-timeout-guard")).not.toBeInTheDocument()
  })
})
