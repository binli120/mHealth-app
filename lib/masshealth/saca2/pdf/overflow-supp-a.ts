/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  SUPP_A_FAMILY_LINES,
  SUPP_A_POLICY_LINES,
  SUPP_A_PROPERTY_LINES,
  SUPP_A_TRANSFER_LINES,
  WRAPPED_TEXTS,
  wrapText,
} from "./derived-supp-a"
import { encodeText } from "./encoders"
import type { OverflowCollector, OverflowSheetSpec } from "./overflow-plan"
import type { VisibleReader } from "./visible-reader"

/**
 * Continuation sheets for Supplement A: transfers beyond the form's three, family members beyond two,
 * (the wizard's property and policy limits equal the form's two, but the counts are still checked) and
 * long answers that do not fit their printed lines. Every read goes through the visible reader, so a
 * hidden supplement, a transfers table whose Yes/No answers are all No, or a gate flipped to No never
 * reaches a sheet.
 */

const text = (raw: unknown): string => encodeText("text", raw) ?? ""
const date = (raw: unknown): string => encodeText("date", raw) ?? ""
const money = (raw: unknown): string => encodeText("money", raw) ?? ""

const STEP = "suppA" as const

function rowsBeyond(reader: VisibleReader, path: string, capacity: number, cells: (get: (key: string) => unknown) => string[]): string[][] {
  const count = reader.rows(STEP, path)
  const rows: string[][] = []
  for (let index = capacity; index < count; index += 1) {
    rows.push(cells((key) => reader.get({ kind: "row", stepId: STEP, path, index, key })))
  }
  return rows
}

const sheet = (title: string, columns: string[], rows: string[][]): OverflowSheetSpec[] =>
  rows.length === 0 ? [] : [{ title, columns, rows }]

const OWNERSHIP_LABELS: Record<string, string> = {
  individual: "Individual",
  tenancyInCommon: "Tenancy in common",
  jointTenancy: "Joint tenancy",
  lifeEstate: "Life estate",
}

export const supplementACollector: OverflowCollector = (reader) => [
  ...sheet(
    "Supplement A: additional resource transfers",
    ["Description of asset/income", "Date of transfer", "Transferred to whom", "Relationship to you or your spouse", "Amount of transfer ($)"],
    rowsBeyond(reader, "transfers", SUPP_A_TRANSFER_LINES, (get) => [
      text(get("description")),
      date(get("dateOfTransfer")),
      text(get("transferredTo")),
      text(get("relationship")),
      money(get("amount")),
    ]),
  ),
  ...sheet(
    "Supplement A: additional people living with your spouse",
    ["Name", "Social Security number", "Relationship", "Date of birth", "Monthly income before deductions ($)"],
    rowsBeyond(reader, "supplements.a.familyAtHome.members", SUPP_A_FAMILY_LINES, (get) => {
      const ssn = text(get("ssn")).replace(/\D/g, "")
      return [
        text(get("name")),
        ssn.length === 9 ? `${ssn.slice(0, 3)}-${ssn.slice(3, 5)}-${ssn.slice(5)}` : "",
        text(get("relationship")),
        date(get("dateOfBirth")),
        money(get("monthlyIncome")),
      ]
    }),
  ),
  ...sheet(
    "Supplement A: additional properties",
    ["Name(s) and address(es) on the ownership papers", "Description and address of the property", "Type of ownership", "Fair-market value ($)"],
    rowsBeyond(reader, "supplements.a.home.properties", SUPP_A_PROPERTY_LINES, (get) => [
      text(get("ownerNames")),
      text(get("propertyAddress")),
      OWNERSHIP_LABELS[text(get("ownershipType"))] ?? "",
      money(get("fairMarketValue")),
    ]),
  ),
  ...sheet(
    "Supplement A: additional long-term-care insurance policies",
    ["Company name and policy number", "Policyholder name", "Effective date", "Premium amount ($)"],
    rowsBeyond(reader, "supplements.a.longTermCareInsurance.policies", SUPP_A_POLICY_LINES, (get) => [
      text(get("companyAndPolicyNumber")),
      text(get("policyholder")),
      date(get("effectiveDate")),
      money(get("premium")),
    ]),
  ),
  ...sheet(
    "Supplement A: text continued",
    ["Question", "Continued text"],
    Object.values(WRAPPED_TEXTS).flatMap((spec) => {
      const rest = wrapText(spec, reader).rest
      return rest === "" ? [] : [[spec.label, rest]]
    }),
  ),
]
