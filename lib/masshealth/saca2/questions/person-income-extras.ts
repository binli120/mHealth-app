/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { DEDUCTION_KEYS, DEDUCTION_LABELS } from "../demographic-options"
import type { OneTimeIncomeItem, RentalUnit, Saca2Answers } from "../types"
import { checkbox, money, number, opts, repeater, select, text, yesNo } from "./builders"
import { person, who } from "./person-context"
import type { Saca2Question, Saca2QuestionContext, Saca2Section } from "./types"

/** Rental income (Q29), one-time-only income (Q30-31), and deductions (Q32) follow the income section. */
const hasIncome = (ctx: Saca2QuestionContext) => person(ctx)?.hasIncome === "yes"
const hasRental = (ctx: Saca2QuestionContext) => hasIncome(ctx) && person(ctx)?.rental.hasRentalIncome === "yes"
const rentalIsOther = (ctx: Saca2QuestionContext) => hasRental(ctx) && person(ctx)?.rental.realEstateType === "other"

const emptyRentalUnit = () => ({ address: "", unit: "", amount: null, isLoss: false, ownerOccupied: null }) satisfies RentalUnit
const emptyOneTimeItem = () => ({ type: "", amount: null, month: null, year: null }) satisfies OneTimeIncomeItem

export const RENTAL_SECTION: Saca2Section = {
  id: "rental",
  title: "Rental income",
  questions: [
    yesNo("rental.hasRentalIncome", who("Do you get rental income?", "Does this person get rental income?"), {
      required: hasIncome,
      visibleWhen: hasIncome,
      help: "If Yes, send proof of current rental income, such as a written statement from each tenant, a copy of the lease, or a current federal tax return. Also send proof of all of the following expenses, if applicable, for the last 12 months: mortgage, taxes, utilities (gas/electric), heat, water/sewer, insurance, condo or co-op fee, repairs and maintenance.",
    }),
    select(
      "rental.realEstateType",
      who("What type of real estate do you own?", "What type of real estate does this person own?"),
      opts([["oneFamily", "One-family"], ["twoFamily", "Two-family"], ["threeFamily", "Three-family"], ["other", "Other (describe)"]]),
      { required: true, visibleWhen: hasRental },
    ),
    text("rental.realEstateTypeOther", "Describe the real estate", { required: true, visibleWhen: rentalIsOther }),
    repeater(
      "rental.units",
      who(
        "How much monthly rental income or loss do you get from each rental unit from the real estate indicated above?",
        "How much monthly rental income or loss does this person get from each rental unit from the real estate indicated above?",
      ),
      {
        questions: [
          text("address", "Address", { required: true }),
          text("unit", "Unit #"),
          money("amount", "Amount of income or loss ($)", { required: true }),
          checkbox("isLoss", "This is a loss"),
          yesNo("ownerOccupied", "Owner-occupied?", { required: true }),
        ],
        emptyItem: emptyRentalUnit,
        addLabel: "Add a rental unit",
        itemTitle: "Rental unit",
        maxItems: 6,
      },
      { required: true, visibleWhen: hasRental, help: "List each rental unit and address separately." },
    ),
    yesNo(
      "rental.paysHeatOrUtilities",
      who("Do you pay for heat or utilities for your tenant?", "Does this person pay for heat or utilities for their tenant?"),
      { required: true, visibleWhen: hasRental },
    ),
  ],
}

function yearValidator(offset: number) {
  return (value: unknown, ctx: Saca2QuestionContext): string | null => {
    const expected = ctx.on.getUTCFullYear() + offset
    return value === expected ? null : `Enter ${expected}.`
  }
}

function validateMonth(value: unknown): string | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12
    ? null
    : "Enter a whole number from 1 to 12."
}

function oneTimeItems(path: string, yearOffset: number, visibleWhen: (ctx: Saca2QuestionContext) => boolean, label: string): Saca2Question {
  return repeater(
    path,
    label,
    {
      questions: [
        text("type", "Type", { required: true }),
        money("amount", "Amount ($)", { required: true }),
        number("month", "Month received (1-12)", { required: true, validate: validateMonth }),
        number("year", "Year received", { required: true, validate: yearValidator(yearOffset) }),
      ],
      emptyItem: emptyOneTimeItem,
      addLabel: "Add a payment",
      itemTitle: "One-time payment",
      maxItems: 4,
    },
    { required: true, visibleWhen },
  )
}

const thisYearYes = (ctx: Saca2QuestionContext) => hasIncome(ctx) && person(ctx)?.oneTimeIncome.thisYear === "yes"
const nextYearYes = (ctx: Saca2QuestionContext) => person(ctx)?.oneTimeIncome.nextYear === "yes"

export const ONE_TIME_SECTION: Saca2Section = {
  id: "oneTime",
  title: "One-time-only income",
  questions: [
    yesNo(
      "oneTimeIncome.thisYear",
      who(
        "Have you or will you receive income during this calendar year as a one-time only payment?",
        "Has or will this person receive income during this calendar year as a one-time only payment?",
      ),
      { required: hasIncome, visibleWhen: hasIncome, help: "An example might include a lump-sum pension payment." },
    ),
    oneTimeItems("oneTimeIncome.thisYearItems", 0, thisYearYes, "One-time payments this calendar year"),
    yesNo(
      "oneTimeIncome.nextYear",
      who(
        "Will you receive income during the next calendar year as a one-time only payment?",
        "Will this person receive income during the next calendar year as a one-time only payment?",
      ),
      { required: true },
    ),
    oneTimeItems("oneTimeIncome.nextYearItems", 1, nextYearYes, "One-time payments next calendar year"),
  ],
}

const deductionsAsked = (ctx: Saca2QuestionContext) => !person(ctx)?.deductions.none

export const DEDUCTIONS_SECTION: Saca2Section = {
  id: "deductions",
  title: "Deductions",
  description: who(
    "What deductions do you report on your income tax return? If you pay for certain things that can be deducted on a federal income tax return, telling us about them could make the cost of health coverage a little lower. Check all that apply. Your deductions should be what you report on your federal income tax return in the section \"Adjusted Gross Income.\" For each deduction you select, give the yearly amount. You can enter up to the maximum deduction amount allowed by the IRS.",
    "What deductions does this person report on their income tax return? If this person pays for certain things that can be deducted on a federal income tax return, telling us about them could make the cost of health coverage a little lower. Check all that apply. This person's deductions should be what they report on their federal income tax return in the section \"Adjusted Gross Income.\" For each deduction selected, give the yearly amount. You can enter up to the maximum deduction amount allowed by the IRS.",
  ),
  questions: [
    checkbox("deductions.none", "None"),
    ...DEDUCTION_KEYS.map((key) =>
      money(`deductions.amounts.${key}`, `${DEDUCTION_LABELS[key]}: yearly amount ($)`, { visibleWhen: deductionsAsked }),
    ),
  ],
}

/** Q32 needs None ticked or at least one yearly amount. Stored amounts under None are ignored. */
export function validateDeductions(answers: Saca2Answers, personIndex: number): Record<string, string> {
  const p = answers.persons[personIndex]
  if (!p || p.deductions.none) return {}
  if (DEDUCTION_KEYS.some((key) => p.deductions.amounts[key] !== null)) return {}
  return { [`persons.${personIndex}.deductions.none`]: "Check None or enter at least one deduction." }
}
