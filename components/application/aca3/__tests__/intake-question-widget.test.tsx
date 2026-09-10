/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { IntakeQuestionWidget } from "@/components/application/aca3/intake-question-widget"
import { validateUsDate } from "@/components/application/aca3/intake-chat-question-builder"

describe("validateUsDate", () => {
  it("rejects a half-typed year (01/12/1) instead of accepting year 0001", () => {
    const { value, error } = validateUsDate("01/12/1")
    expect(value).toBeNull()
    expect(error).toBe("Enter a full 4-digit year.")
  })

  it("rejects an out-of-range year like 0001", () => {
    const { value, error } = validateUsDate("01/12/0001")
    expect(value).toBeNull()
    expect(error).toMatch(/year must be between/i)
  })

  it("accepts a full valid date and zero-pads it", () => {
    expect(validateUsDate("1/2/1990").value).toBe("01/02/1990")
  })

  it("rejects an impossible calendar day", () => {
    expect(validateUsDate("02/30/1990").value).toBeNull()
  })

  it("rejects a future date when allowFuture is false", () => {
    const nextYear = new Date().getFullYear() + 1
    const { value, error } = validateUsDate(`01/01/${nextYear}`, { allowFuture: false })
    expect(value).toBeNull()
    expect(error).toMatch(/future|year must be between/i)
  })

  it("allows a near-future date when allowFuture is true (non-DOB date field)", () => {
    const nextYear = new Date().getFullYear() + 1
    expect(validateUsDate(`01/01/${nextYear}`).value).toBe(`01/01/${nextYear}`)
  })
})

describe("IntakeQuestionWidget date kind", () => {
  it("does not submit until a full 4-digit year is entered and confirmed", () => {
    const onAnswer = vi.fn()
    render(<IntakeQuestionWidget spec={{ kind: "date" }} onAnswer={onAnswer} />)

    const input = screen.getByPlaceholderText("MM/DD/YYYY")

    // Typing digits up through a single year digit must NOT fire onAnswer.
    fireEvent.change(input, { target: { value: "01121" } })
    expect(onAnswer).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /confirm date/i })).toBeDisabled()

    // Full valid date enables Confirm; clicking it submits the padded value.
    fireEvent.change(input, { target: { value: "01121990" } })
    const confirm = screen.getByRole("button", { name: /confirm date/i })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(onAnswer).toHaveBeenCalledWith("01/12/1990")
  })

  it("rejects a future date when the date widget is marked noFuture (DOB)", () => {
    const onAnswer = vi.fn()
    render(<IntakeQuestionWidget spec={{ kind: "date", noFuture: true }} onAnswer={onAnswer} />)

    const nextYear = new Date().getFullYear() + 1
    fireEvent.change(screen.getByPlaceholderText("MM/DD/YYYY"), {
      target: { value: `0101${nextYear}` },
    })
    expect(screen.getByRole("button", { name: /confirm date/i })).toBeDisabled()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it("shows a year error for 01/12/0001 and keeps Confirm disabled", () => {
    const onAnswer = vi.fn()
    render(<IntakeQuestionWidget spec={{ kind: "date" }} onAnswer={onAnswer} />)

    fireEvent.change(screen.getByPlaceholderText("MM/DD/YYYY"), { target: { value: "01120001" } })
    expect(screen.getByRole("alert")).toHaveTextContent(/year must be between/i)
    expect(screen.getByRole("button", { name: /confirm date/i })).toBeDisabled()
    expect(onAnswer).not.toHaveBeenCalled()
  })
})
