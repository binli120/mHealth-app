/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CurrencyInput } from "@/components/shared/CurrencyInput"

/** CurrencyInput is fully controlled; wrap it so onChange round-trips into value like a real parent. */
function ControlledCurrencyInput({ initial = 0 }: { initial?: number }) {
  const [value, setValue] = useState(initial)
  return <CurrencyInput label="Wages" value={value} onChange={setValue} id="wages" />
}

describe("CurrencyInput", () => {
  it("formats a preset value with commas and cents on mount", () => {
    render(<CurrencyInput label="Wages" value={10000} onChange={vi.fn()} id="wages" />)
    expect(screen.getByLabelText("Wages")).toHaveValue("10,000.00")
  })

  it("adds thousands separators live while typing", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CurrencyInput label="Wages" value={0} onChange={onChange} id="wages" />)

    await user.type(screen.getByLabelText("Wages"), "10000")

    expect(screen.getByLabelText("Wages")).toHaveValue("10,000")
    expect(onChange).toHaveBeenLastCalledWith(10000)
  })

  it("reformats to two decimal places on blur", async () => {
    const user = userEvent.setup()
    render(<ControlledCurrencyInput />)

    const input = screen.getByLabelText("Wages")
    await user.type(input, "1500.5")
    await user.tab()

    expect(input).toHaveValue("1,500.50")
  })

  it("clamps negative and non-numeric input to zero", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CurrencyInput label="Wages" value={0} onChange={onChange} id="wages" />)

    await user.type(screen.getByLabelText("Wages"), "abc")

    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it("shows an empty field for a zero value when not focused", () => {
    render(<CurrencyInput label="Wages" value={0} onChange={vi.fn()} id="wages" />)
    expect(screen.getByLabelText("Wages")).toHaveValue("")
  })
})
