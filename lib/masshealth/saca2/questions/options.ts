/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { opts } from "./builders"

/** Every value of `IncomeFrequency`, in form order. */
export const INCOME_FREQUENCIES = opts([
  ["weekly", "Weekly"],
  ["every2weeks", "Every 2 weeks"],
  ["twiceMonthly", "Twice a month"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["yearly", "Yearly"],
  ["oneTime", "One time only"],
])

/** Recurring frequencies only: premiums and excluded income are never "one time". */
export const PREMIUM_FREQUENCIES = INCOME_FREQUENCIES.filter((o) => o.value !== "oneTime")
