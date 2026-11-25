/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { EMPLOYER_COVERAGE_LINES, MEDICARE_LINES } from "./derived-health"
import { encodeText } from "./encoders"
import type { OverflowCollector, OverflowSheetSpec } from "./overflow-plan"
import type { VisibleReader } from "./visible-reader"

/**
 * Continuation sheets for Step 6: the form has two Medicare blocks and one employer-coverage block,
 * the wizard allows four of each. Rows are read through the visible reader, so rows of a section
 * whose gate is "no" (or fields hidden by their own conditions, like a Part D start date under
 * "no Part D") never reach a sheet.
 */

const date = (raw: unknown): string => encodeText("date", raw) ?? ""
const text = (raw: unknown): string => encodeText("text", raw) ?? ""
const yesNo = (raw: unknown): string => (raw === "yes" ? "Yes" : raw === "no" ? "No" : "")

function rowsBeyond(reader: VisibleReader, path: string, capacity: number, cells: (get: (key: string) => unknown) => string[]): string[][] {
  const count = reader.rows("healthInsurance", path)
  const rows: string[][] = []
  for (let index = capacity; index < count; index += 1) {
    rows.push(cells((key) => reader.get({ kind: "row", stepId: "healthInsurance", path, index, key })))
  }
  return rows
}

const sheet = (title: string, columns: string[], rows: string[][]): OverflowSheetSpec[] =>
  rows.length === 0 ? [] : [{ title, columns, rows }]

export const healthCollector: OverflowCollector = (reader) => [
  ...sheet(
    "Additional people with Medicare",
    [
      "Name of person covered",
      "Medicare claim number",
      "Coverage start",
      "Medicare Part D plan?",
      "Part D coverage start",
      "Medigap policy?",
      "Medigap plan name",
      "Medigap coverage start",
    ],
    rowsBeyond(reader, "health.medicare", MEDICARE_LINES, (get) => [
      text(get("personName")),
      text(get("claimNumber")),
      date(get("coverageStart")),
      yesNo(get("hasPartD")),
      date(get("partDStart")),
      yesNo(get("hasMedigap")),
      text(get("medigapPlan")),
      date(get("medigapStart")),
    ]),
  ),
  ...sheet(
    "Additional employer coverage",
    ["Name of employer", "Plan name", "Covered household members", "Policy number or member ID", "Start and end dates"],
    rowsBeyond(reader, "health.employerCoverage", EMPLOYER_COVERAGE_LINES, (get) => [
      text(get("employerName")),
      text(get("planName")),
      text(get("coveredNames")),
      text(get("policyNumber")),
      text(get("startEndDates")),
    ]),
  ),
]
