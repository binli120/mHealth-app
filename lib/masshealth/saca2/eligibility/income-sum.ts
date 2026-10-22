/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { MONTHLY_NET_KINDS } from "../questions/person-income"
import { toMonthlyCents } from "./money"
import type { Saca2PersonInputs } from "./types"

export interface MonthlyIncome {
  /** Monthly countable income in cents (floored at 0), or null when it cannot be worked out. */
  cents: number | null
  /** One-time income was reported; it is not counted monthly and needs review. */
  oneTimeIncome: boolean
}

/** One person's monthly income from their visible income rows and rental units. */
export function monthlyIncomeOf(person: Saca2PersonInputs): MonthlyIncome {
  if (person.hasIncome === "no") return { cents: 0, oneTimeIncome: false }
  let oneTimeIncome = person.oneTimeIncomeThisYear > 0
  if (person.hasIncome !== "yes") return { cents: null, oneTimeIncome }
  // Income answered Yes but nothing listed: the amount is unknown, not zero.
  if (person.income.length === 0 && person.rental.length === 0) return { cents: null, oneTimeIncome }
  let total = 0
  for (const line of person.income) {
    if (typeof line.amount !== "number") return { cents: null, oneTimeIncome }
    if (MONTHLY_NET_KINDS.includes(line.kind)) {
      total += line.isLoss ? -line.amount : line.amount
      continue
    }
    if (line.frequency === "oneTime") {
      oneTimeIncome = true
      continue
    }
    const monthly = toMonthlyCents(line.amount, line.frequency)
    if (monthly === null) return { cents: null, oneTimeIncome }
    total += monthly
  }
  for (const unit of person.rental) {
    if (typeof unit.amount !== "number") return { cents: null, oneTimeIncome }
    total += unit.isLoss ? -unit.amount : unit.amount
  }
  return { cents: Math.max(0, total), oneTimeIncome }
}
