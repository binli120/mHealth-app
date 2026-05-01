/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AuthGuard } from "@/components/shared/AuthGuard"

const mockReplace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const { mockGetSafeSupabaseSession } = vi.hoisted(() => ({
  mockGetSafeSupabaseSession: vi.fn(),
}))
vi.mock("@/lib/supabase/client", () => ({
  getSafeSupabaseSession: mockGetSafeSupabaseSession,
}))

vi.mock("@/components/shared/IdleTimeoutGuard", () => ({
  IdleTimeoutGuard: () => <div data-testid="idle-timeout-guard" />,
}))

describe("AuthGuard", () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockGetSafeSupabaseSession.mockReset()
  })

  it("renders children and idle timeout guard after a valid session is confirmed", async () => {
    mockGetSafeSupabaseSession.mockResolvedValue({ session: { user: { id: "user-1" } }, error: null })

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
    mockGetSafeSupabaseSession.mockResolvedValue({ session: { user: { id: "user-1" } }, error: null })

    render(
      <AuthGuard idleTimeout={false}>
        <div>Protected content</div>
      </AuthGuard>,
    )

    await expect(screen.findByText("Protected content")).resolves.toBeInTheDocument()
    expect(screen.queryByTestId("idle-timeout-guard")).not.toBeInTheDocument()
  })

  it("redirects unauthenticated users to login with the requested next path", async () => {
    mockGetSafeSupabaseSession.mockResolvedValue({ session: null, error: null })

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

  it("revalidates restored protected pages and redirects when the session is gone", async () => {
    mockGetSafeSupabaseSession
      .mockResolvedValue({ session: null, error: null })
      .mockResolvedValueOnce({ session: { user: { id: "user-1" } }, error: null })
      .mockResolvedValueOnce({ session: { user: { id: "user-1" } }, error: null })

    render(
      <AuthGuard next="/customer/dashboard">
        <div>Protected content</div>
      </AuthGuard>,
    )

    await expect(screen.findByText("Protected content")).resolves.toBeInTheDocument()

    const pageShowEvent = new Event("pageshow") as PageTransitionEvent
    Object.defineProperty(pageShowEvent, "persisted", { value: true })
    fireEvent(window, pageShowEvent)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/auth/login?next=%2Fcustomer%2Fdashboard")
    })
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument()
  })
})
