/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { MONTH_KEYS, MONTH_LABELS } from "../demographic-options"
import { checkbox, date, money, number, opts, repeater, select, text, yesNo } from "./builders"
import { INCOME_FREQUENCIES } from "./options"
import { person, who } from "./person-context"
import type { Saca2Question, Saca2QuestionContext, Saca2Section } from "./types"

/** Rental income (kind `rental`) is asked in its own section, form Q29, so it is not offered here. */
export const INCOME_KINDS = opts([
  ["wages", "Wages or salary"],
  ["selfEmployment", "Self-employment"],
  ["socialSecurity", "Social Security benefits"],
  ["pension", "Retirement or pension"],
  ["annuity", "Annuities"],
  ["trust", "Trusts"],
  ["unemployment", "Unemployment"],
  ["investment", "Interest, dividends, and other investment income"],
  ["royalty", "Royalty income"],
  ["alimony", "Alimony received"],
  ["veterans", "Federal veteran's benefits"],
  ["militaryRetirement", "Military retirement pay"],
  ["otherTaxable", "Other taxable income"],
  ["capitalGains", "Capital gains"],
  ["farmingFishing", "Net farming or fishing income"],
  ["lottery", "Lottery and gambling winnings"],
])

/** Kinds reported as an average monthly net profit or loss instead of an amount and a frequency. */
const MONTHLY_NET_KINDS: readonly unknown[] = ["selfEmployment", "capitalGains", "farmingFishing"]

const kindIs = (...kinds: string[]) => (ctx: Saca2QuestionContext) => kinds.includes(ctx.item?.kind as string)
const isMonthlyNet = (ctx: Saca2QuestionContext) => MONTHLY_NET_KINDS.includes(ctx.item?.kind)
const notMonthlyNet = (ctx: Saca2QuestionContext) => !isMonthlyNet(ctx)
const isWages = kindIs("wages")
const isSeasonal = (ctx: Saca2QuestionContext) => isWages(ctx) && ctx.item?.seasonal === "yes"

/** Several kinds share one row field (`description`, `effectiveDate`) with different wording; keep ids distinct. */
const variant = (id: string, question: Saca2Question): Saca2Question => ({ ...question, id })

const seasonKey = (month: (typeof MONTH_KEYS)[number]) => `season${month[0].toUpperCase()}${month.slice(1)}`

function validateSeasonalMonths(value: unknown, ctx: Saca2QuestionContext): string | null {
  if (value !== "yes") return null
  const picked = MONTH_KEYS.some((month) => ctx.item?.[seasonKey(month)] === true)
  return picked ? null : "Select at least one month."
}

/** Form Q22-28 (Person 2: the matching income questions): jobs, self-employment, and other income. */
export const INCOME_SECTION: Saca2Section = {
  id: "income",
  title: "Income",
  questions: [
    yesNo("hasIncome", who("Do you have any income?", "Does this person have any income?"), { required: true }),
    repeater(
      "income",
      "Income sources",
      {
        questions: [
          select("kind", "Type of income", INCOME_KINDS, { required: true }),
          money(
            "amount",
            (ctx) => (isMonthlyNet(ctx) ? "Average monthly net income or loss ($)" : "Amount before taxes ($)"),
            {
              required: true,
              help: (ctx) =>
                isMonthlyNet(ctx)
                  ? "Net income is your profit after business expenses are paid. Enter the amount without a minus sign and check the box below if it is a loss."
                  : "",
            },
          ),
          checkbox("isLoss", "This is a monthly loss, not a profit", { visibleWhen: isMonthlyNet }),
          select("frequency", "How often", INCOME_FREQUENCIES, { required: notMonthlyNet, visibleWhen: notMonthlyNet }),
          text("employerNameAndAddress", "Employer name and address", { visibleWhen: isWages }),
          text("employerFederalTaxId", "Employer Federal Tax ID #", { visibleWhen: isWages }),
          date("effectiveDate", "Income effective date", { visibleWhen: isWages }),
          number("hoursPerWeek", "Average hours worked each week", {
            required: kindIs("selfEmployment"),
            visibleWhen: kindIs("wages", "selfEmployment"),
          }),
          yesNo("seasonal", who("Are you seasonally employed?", "Is this person seasonally employed?"), {
            required: isWages,
            visibleWhen: isWages,
            validate: validateSeasonalMonths,
          }),
          ...MONTH_KEYS.map((month) => checkbox(seasonKey(month), MONTH_LABELS[month], { visibleWhen: isSeasonal })),
          text("description", "What type of work do you do?", { required: true, visibleWhen: kindIs("selfEmployment") }),
          variant("description.pension", text("description", "Source", { visibleWhen: kindIs("pension") })),
          variant("description.otherTaxable", text("description", "Type", { required: true, visibleWhen: kindIs("otherTaxable") })),
          money(
            "preTcjaAmount",
            "Alimony received under an agreement finalized before January 1, 2019 ($)",
            { visibleWhen: kindIs("alimony") },
          ),
          variant("effectiveDate.lottery", date("effectiveDate", "Effective date", { required: true, visibleWhen: kindIs("lottery") })),
        ],
        emptyItem: () => ({ kind: null, amount: null, frequency: null }),
        addLabel: "Add an income source",
        itemTitle: "Income source",
        maxItems: 15,
      },
      { required: true, visibleWhen: (ctx) => person(ctx)?.hasIncome === "yes" },
    ),
    money("expectedIncomeThisYear", "Total expected income this calendar year ($)", {
      required: true,
      visibleWhen: (ctx) => person(ctx)?.hasIncome === "yes",
    }),
    money("expectedIncomeNextYear", "Total expected income next calendar year, if different ($)", {
      visibleWhen: (ctx) => person(ctx)?.hasIncome === "yes",
    }),
  ],
}
