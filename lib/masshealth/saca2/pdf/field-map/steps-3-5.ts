/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { fitLines, PREVIOUS_BILLS_LINES } from "../derived-assets"
import type { Encoder, FieldEntry, Source } from "../types"

/** Every Yes / No group on this page: the Yes widget is the first (left) one, `/1`; No is `/2`. */
const YES_NO_1_2: Encoder = { kind: "yesNo", yes: "1", no: "2" }

const answer = (field: string, stepId: "aian" | "previousBills", path: string, encode: Encoder): FieldEntry => ({
  fields: [field],
  source: { kind: "answer", stepId, path },
  encode,
})

const requestRow = (line: number, key: string, field: string, encode: Encoder): FieldEntry => ({
  fields: [field],
  source: { kind: "row", stepId: "previousBills", path: "previousMedicalBills.requests", index: line, key } satisfies Source,
  encode,
})

/** The two person lines of Step 4; the wizard allows five, the rest go on a continuation sheet. */
const REQUEST_LINES: Array<{ name: string; date: string; changed: string }> = [
  { name: "S4. Name", date: "S4. Earliest date requested", changed: "S4.   Any change in circumstances during this time?" },
  { name: "S4. Name_2", date: "S4. Earliest date requested_2", changed: "S4.   Any change in circumstances during this time?_2" },
]

/** Form page 12 (PDF index 13) below the yearly income: Step 3 (AI/AN) and Step 4 (previous medical bills). */
export const STEPS_3_4_ENTRIES: FieldEntry[] = [
  answer("Are you or is anyone in your household an American Indian or Alaska Native?", "aian", "aian.anyMember", YES_NO_1_2),
  answer(
    "Do you or your spouse have bills for medical services you got in the three months before the month we got your application?",
    "previousBills",
    "previousMedicalBills.hasBills",
    YES_NO_1_2,
  ),
  answer(
    "Do you or your spouse want to apply for MassHealth for that time period?",
    "previousBills",
    "previousMedicalBills.wantsCoverageForPeriod",
    YES_NO_1_2,
  ),
  answer("If Yes what is the earliest date for which you need MassHealth_S4", "previousBills", "previousMedicalBills.earliestDate", "date"),
  ...fitLines(REQUEST_LINES, PREVIOUS_BILLS_LINES, "REQUEST_LINES").flatMap((line, index) => [
    requestRow(index, "name", line.name, "text"),
    requestRow(index, "earliestDateRequested", line.date, "date"),
    requestRow(index, "circumstancesChanged", line.changed, YES_NO_1_2),
  ]),
]
