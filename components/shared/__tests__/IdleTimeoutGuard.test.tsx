/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { IdleTimeoutGuard } from "@/components/shared/IdleTimeoutGuard"
import { useIdleTimeout } from "@/hooks/use-idle-timeout"

vi.mock("@/hooks/use-idle-timeout", () => ({
  useIdleTimeout: vi.fn(),
}))

const mockResetTimer = vi.fn()

describe("IdleTimeoutGuard", () => {
  beforeEach(() => {
    mockResetTimer.mockClear()
    vi.mocked(useIdleTimeout).mockReturnValue({
      isWarning: false,
      secondsRemaining: 120,
      resetTimer: mockResetTimer,
    })
  })

  it("stays hidden before the warning window", () => {
    render(<IdleTimeoutGuard />)

    expect(screen.queryByText(/session expiring soon/i)).not.toBeInTheDocument()
  })

  it("shows a countdown once the warning window is active", () => {
    vi.mocked(useIdleTimeout).mockReturnValue({
      isWarning: true,
      secondsRemaining: 75,
      resetTimer: mockResetTimer,
    })

    render(<IdleTimeoutGuard />)

    expect(screen.getByText(/session expiring soon/i)).toBeInTheDocument()
    expect(screen.getByText("1:15")).toBeInTheDocument()
  })

  it("resets the idle timer when the user chooses to stay signed in", async () => {
    vi.mocked(useIdleTimeout).mockReturnValue({
      isWarning: true,
      secondsRemaining: 30,
      resetTimer: mockResetTimer,
    })

    render(<IdleTimeoutGuard />)

    await userEvent.click(screen.getByRole("button", { name: /stay signed in/i }))

    expect(mockResetTimer).toHaveBeenCalledOnce()
  })
})
