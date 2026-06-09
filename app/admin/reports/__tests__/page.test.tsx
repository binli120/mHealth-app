/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import AdminReportsPage from "@/app/admin/reports/page"

const { mockDownloadCsv } = vi.hoisted(() => ({
  mockDownloadCsv: vi.fn(),
}))

vi.mock("@/app/admin/reports/page.utils", () => ({
  downloadCsv: mockDownloadCsv,
}))

describe("AdminReportsPage", () => {
  beforeEach(() => {
    mockDownloadCsv.mockReset()
    mockDownloadCsv.mockResolvedValue(undefined)
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-09T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("exports filtered applications with a dated filename", async () => {
    const { container } = render(<AdminReportsPage />)

    const [fromInput, toInput] = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='date']"))
    fireEvent.change(fromInput, { target: { value: "2026-05-01" } })
    fireEvent.change(toInput, { target: { value: "2026-05-31" } })
    fireEvent.click(screen.getAllByRole("button", { name: /download csv/i })[0])

    await Promise.resolve()
    expect(mockDownloadCsv).toHaveBeenCalledWith(
      "/api/admin/export?type=applications&from=2026-05-01&to=2026-05-31T23%3A59%3A59",
      "applications-2026-06-09.csv",
    )
  })

  it("exports users with the expected admin endpoint", async () => {
    render(<AdminReportsPage />)

    fireEvent.click(screen.getAllByRole("button", { name: /download csv/i })[1])

    await Promise.resolve()
    expect(mockDownloadCsv).toHaveBeenCalledWith(
      "/api/admin/export?type=users",
      "users-2026-06-09.csv",
    )
  })
})
