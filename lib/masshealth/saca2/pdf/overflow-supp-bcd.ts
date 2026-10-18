/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  SUPP_B_CAPACITY,
  SUPP_B_MEMBERS_PATH,
  SUPP_D_JOBS_PATH,
  SUPP_D_PAGES,
  federalTaxIdDigits,
} from "./derived-supp-bcd"
import { encodeText } from "./encoders"
import type { OverflowCollector } from "./overflow-plan"

/**
 * Supplements B, C and D print every record on a real copy of the form page (page-copies.ts), so nothing
 * overflows by count. What the pages cannot hold goes on one sheet, "Supplement D: additional information":
 * - item 14a, the name of the lowest-cost individual plan: the template prints the question without a
 *   field for the answer;
 * - a Federal Tax ID that is not nine digits (the form has nine single-digit boxes).
 * Every read goes through the visible reader, so a hidden Supplement D or a job that is not eligible
 * (its plan answers are hidden) never reaches the sheet. A wizard that allowed more people or jobs than
 * the copies hold is a mapping bug and throws (counts only, no answers) rather than dropping a record.
 */
const text = (raw: unknown): string => encodeText("text", raw) ?? ""

export const supplementBcdCollector: OverflowCollector = (reader) => {
  if (reader.rows("suppB", SUPP_B_MEMBERS_PATH) > SUPP_B_CAPACITY) {
    throw new Error(`Supplement B has more people than the ${SUPP_B_CAPACITY} the form pages and their copies hold`)
  }
  const jobs = reader.rows("suppD", SUPP_D_JOBS_PATH)
  if (jobs > SUPP_D_PAGES) throw new Error(`Supplement D has more jobs than the ${SUPP_D_PAGES} the form pages and their copies hold`)

  const rows: string[][] = []
  for (let index = 0; index < jobs; index += 1) {
    const get = (key: string) => reader.get({ kind: "row", stepId: "suppD", path: SUPP_D_JOBS_PATH, index, key })
    const employee = text(get("employeeName"))
    const employer = text(get("employerName"))
    const job = `Job ${index + 1} - ${[employee, employer].filter((part) => part !== "").join(" / ")}`.replace(/ - $/, "")
    const plan = text(get("individualPlanName"))
    if (plan !== "") rows.push([job, "14a. Name of the lowest-cost individual health plan offered to the employee", plan])
    const taxId = text(get("employerFederalTaxId"))
    if (taxId !== "" && federalTaxIdDigits(taxId) === undefined) {
      rows.push([job, "5. Federal Tax ID (not nine digits, so it does not fit the form's boxes)", taxId])
    }
  }
  return rows.length === 0
    ? []
    : [{ title: "Supplement D: additional information", columns: ["Job (employee / employer)", "Item", "Answer"], rows }]
}
