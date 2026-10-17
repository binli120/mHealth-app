/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Saca2SaveStatus } from "@/components/application/saca2/saca2-save-status"

describe("Saca2SaveStatus", () => {
  it("renders nothing visible when idle, inside a polite live region", () => {
    render(<Saca2SaveStatus status="idle" onRetry={vi.fn()} />)
    const region = screen.getByRole("status")
    expect(region).toHaveAttribute("aria-live", "polite")
    expect(region).toHaveTextContent("")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("shows the saving and saved lines without a Retry button", () => {
    const { rerender } = render(<Saca2SaveStatus status="saving" onRetry={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("Saving…")
    rerender(<Saca2SaveStatus status="saved" onRetry={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("All changes saved")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("shows the error line with a type=button Retry that calls onRetry", async () => {
    const onRetry = vi.fn()
    render(<Saca2SaveStatus status="error" onRetry={onRetry} />)
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't save your changes")
    const retry = screen.getByRole("button", { name: "Retry" })
    expect(retry).toHaveAttribute("type", "button")
    await userEvent.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
