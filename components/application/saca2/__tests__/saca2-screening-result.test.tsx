/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const engine = vi.hoisted(() => ({ fail: false }))
vi.mock("@/lib/masshealth/saca2/eligibility-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/masshealth/saca2/eligibility-engine")>()
  return {
    ...actual,
    evaluateSaca2Eligibility: (...args: Parameters<typeof actual.evaluateSaca2Eligibility>) => {
      if (engine.fail) throw new Error("boom")
      return actual.evaluateSaca2Eligibility(...args)
    },
  }
})

import { Saca2ScreeningResult } from "@/components/application/saca2/saca2-screening-result"
import { SACA2_SCREENING_LABEL } from "@/lib/masshealth/saca2/eligibility-engine"
import { getSyntheticCase } from "@/lib/masshealth/saca2/synthetic-cases"

const ON = new Date("2026-10-13T12:00:00Z")

afterEach(() => {
  engine.fail = false
  vi.restoreAllMocks()
})

describe("Saca2ScreeningResult", () => {
  it("shows the screening label, the status, estimates, and the checklist", () => {
    render(<Saca2ScreeningResult answers={getSyntheticCase("couple-spouse-in-nursing-facility").answers} on={ON} />)
    const panel = screen.getByTestId("saca2-screening")
    expect(within(panel).getByRole("heading", { name: "Screening estimate" })).toBeInTheDocument()
    expect(screen.getByTestId("saca2-screening-label")).toHaveTextContent(SACA2_SCREENING_LABEL)
    expect(screen.getByTestId("saca2-screening-status")).toHaveAttribute("data-status", "NEEDS_REVIEW")
    expect(panel).toHaveTextContent("Monthly allowance for your spouse at home: $2,766.50")
    const list = screen.getByTestId("saca2-document-checklist")
    expect(within(list).getByText("Statements for every account for the past 60 months")).toBeInTheDocument()
    expect(within(list).getByText("Proof of each transfer of income or assets in the past 60 months")).toBeInTheDocument()
    expect(within(panel).queryByRole("note")).toBeNull()
    expect(panel).not.toHaveTextContent(/approved/i)
  })

  it("links to the ACA-3 chooser for a child caregiver", () => {
    render(<Saca2ScreeningResult answers={getSyntheticCase("senior-parent-of-child-under-19").answers} on={ON} />)
    expect(screen.getByTestId("saca2-screening-status")).toHaveAttribute("data-status", "REDIRECT_ACA3")
    expect(screen.getByRole("link", { name: "Go to the ACA-3 application" })).toHaveAttribute("href", "/application/type?recommended=aca3")
  })

  it("degrades to a generic NEEDS_REVIEW message when the engine throws", () => {
    engine.fail = true
    render(<Saca2ScreeningResult answers={getSyntheticCase("single-senior-home").answers} on={ON} />)
    expect(screen.getByTestId("saca2-screening-status")).toHaveAttribute("data-status", "NEEDS_REVIEW")
    expect(screen.getByText(/couldn't estimate a result/)).toBeInTheDocument()
    expect(screen.getByTestId("saca2-screening-label")).toHaveTextContent(SACA2_SCREENING_LABEL)
  })

  it("does not log, store, or send anything", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.reject(new Error("no network")))
    const logs = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    render(<Saca2ScreeningResult answers={getSyntheticCase("couple-spouse-in-nursing-facility").answers} on={ON} />)
    expect(setItem).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    for (const spy of logs) expect(spy).not.toHaveBeenCalled()
  })
})
