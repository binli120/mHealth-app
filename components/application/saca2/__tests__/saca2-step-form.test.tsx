/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Saca2StepForm } from "@/components/application/saca2/saca2-step-form"
import { emptySaca2Answers, emptySaca2Person } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function renderForm(overrides: {
  stepId?: "intake" | "person1" | "person2" | "aian"
  answers?: ReturnType<typeof emptySaca2Answers>
  errors?: Record<string, string>
  onChange?: (path: string, value: unknown) => void
  personIndex?: number
} = {}) {
  const onChange = overrides.onChange ?? vi.fn()
  render(
    <Saca2StepForm
      stepId={overrides.stepId ?? "person1"}
      answers={overrides.answers ?? emptySaca2Answers()}
      personIndex={overrides.personIndex ?? 0}
      errors={overrides.errors ?? {}}
      onChange={onChange}
      on={ON}
    />,
  )
  return onChange
}

describe("Saca2StepForm: person step", () => {
  it("reports typed text with the absolute answer path", async () => {
    const onChange = renderForm()
    await userEvent.type(screen.getByLabelText("First name"), "A")
    expect(onChange).toHaveBeenLastCalledWith("persons.0.firstName", "A")
  })

  it("uses Person 2 wording and paths for the second person", async () => {
    const answers = emptySaca2Answers()
    answers.persons.push(emptySaca2Person())
    const onChange = renderForm({ stepId: "person2", personIndex: 1, answers })
    expect(screen.getByRole("group", { name: /is this person applying for health coverage/i })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("First name"), "B")
    expect(onChange).toHaveBeenLastCalledWith("persons.1.firstName", "B")
    expect(screen.getByLabelText(/related to person 1/i)).toBeInTheDocument()
  })

  it("answers yes/no with radios inside a labelled group", async () => {
    const onChange = renderForm()
    const group = screen.getByRole("group", { name: /are you applying for health coverage for yourself/i })
    await userEvent.click(within(group).getByRole("radio", { name: "Yes" }))
    expect(onChange).toHaveBeenLastCalledWith("persons.0.applyingForCoverage", "yes")
  })

  it("hides questions whose condition is not met and shows them when it is", () => {
    renderForm()
    expect(screen.queryByLabelText("Social Security number")).not.toBeInTheDocument()
    const answers = emptySaca2Answers()
    answers.persons[0].applyingForCoverage = "yes"
    answers.persons[0].hasSsn = "yes"
    renderForm({ answers })
    expect(screen.getByLabelText("Social Security number")).toBeInTheDocument()
  })

  it("parses money into a number and blank into null", async () => {
    // The form is controlled and the test's onChange does not update props, so each
    // interaction starts from the value 5 and is checked on its own.
    const answers = emptySaca2Answers()
    answers.persons[0].hasIncome = "yes"
    answers.persons[0].expectedIncomeThisYear = 5
    const onChange = renderForm({ answers })
    const field = screen.getByLabelText(/total expected income this calendar year/i)
    await userEvent.type(field, "1")
    expect(onChange).toHaveBeenLastCalledWith("persons.0.expectedIncomeThisYear", 51)
    await userEvent.clear(field)
    expect(onChange).toHaveBeenLastCalledWith("persons.0.expectedIncomeThisYear", null)
  })

  it("shows an error with role=alert linked to its field", () => {
    renderForm({ errors: { "persons.0.firstName": "This question is required." } })
    const input = screen.getByLabelText("First name")
    expect(input).toHaveAttribute("aria-invalid", "true")
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("This question is required.")
    expect(input.getAttribute("aria-describedby")).toContain(alert.id)
  })

  it("renders a select with its options and reports the chosen value", async () => {
    const onChange = renderForm()
    await userEvent.selectOptions(screen.getByLabelText(/sex assigned at birth/i), "female")
    expect(onChange).toHaveBeenLastCalledWith("persons.0.sexAtBirth", "female")
  })

  it("reports checkbox changes as booleans", async () => {
    const onChange = renderForm()
    await userEvent.click(screen.getByLabelText(/no home address/i))
    expect(onChange).toHaveBeenLastCalledWith("persons.0.noHomeAddress", true)
  })
})

describe("Saca2StepForm: income repeater", () => {
  function withIncome(items: unknown[]) {
    const answers = emptySaca2Answers()
    answers.persons[0].hasIncome = "yes"
    ;(answers.persons[0].income as unknown[]) = items
    return answers
  }

  it("adds an income item with the configured empty item", async () => {
    const onChange = renderForm({ answers: withIncome([]) })
    await userEvent.click(screen.getByRole("button", { name: "Add an income source" }))
    expect(onChange).toHaveBeenLastCalledWith("persons.0.income", [{ kind: null, amount: null, frequency: null }])
  })

  it("edits one item by absolute path and removes an item", async () => {
    const onChange = renderForm({
      answers: withIncome([
        { kind: "wages", amount: 5, frequency: "monthly" },
        { kind: "pension", amount: 7, frequency: "monthly" },
      ]),
    })
    const amounts = screen.getAllByLabelText(/amount before taxes/i)
    expect(amounts).toHaveLength(2)
    await userEvent.type(amounts[1], "1")
    expect(onChange).toHaveBeenLastCalledWith("persons.0.income.1.amount", 71)

    await userEvent.click(screen.getByRole("button", { name: "Remove Income source 1" }))
    expect(onChange).toHaveBeenLastCalledWith("persons.0.income", [{ kind: "pension", amount: 7, frequency: "monthly" }])
  })

  it("shows employer fields only for wages", () => {
    renderForm({
      answers: withIncome([
        { kind: "wages", amount: 5, frequency: "monthly" },
        { kind: "pension", amount: 7, frequency: "monthly" },
      ]),
    })
    expect(screen.getAllByLabelText(/employer name and address/i)).toHaveLength(1)
  })

  it("stops offering Add at the maximum number of items", () => {
    const items = Array.from({ length: 15 }, () => ({ kind: "wages", amount: 1, frequency: "monthly" }))
    renderForm({ answers: withIncome(items) })
    expect(screen.queryByRole("button", { name: "Add an income source" })).not.toBeInTheDocument()
  })
})

describe("Saca2StepForm: root steps", () => {
  it("intake checkboxes write to their absolute paths", async () => {
    const onChange = renderForm({ stepId: "intake" })
    await userEvent.click(screen.getByLabelText(/long-term care \(nursing home/i))
    expect(onChange).toHaveBeenLastCalledWith("intake.programs.longTermCare", true)
  })

  it("renders nothing for a step without content", () => {
    const { container } = render(
      <Saca2StepForm stepId="assets" answers={emptySaca2Answers()} personIndex={0} errors={{}} onChange={vi.fn()} on={ON} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
