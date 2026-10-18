/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  accountTypeLabel,
  BURIAL_KINDS,
  OWNERS,
  placeAnnuities,
  placeBank,
  placeBurial,
  placeDeposits,
  placeLifeInsurance,
  placeRealEstate,
  placeSecurities,
  placeTrusts,
  placeVehicles,
  PREVIOUS_BILLS_LINES,
  propertyTypeLabel,
  readRow,
  SECURITIES_KINDS,
  type Placement,
  type RowRef,
} from "./derived-assets"
import { encodeText } from "./encoders"
import type { OverflowCollector, OverflowSheetSpec } from "./overflow-plan"
import type { VisibleReader } from "./visible-reader"

/**
 * Continuation sheets for Steps 4 and 5: the rows the form's blocks cannot hold. Which rows those are
 * comes from the same `place*` functions the field map's derived values use, and every cell is read
 * through the visible reader, so rows of a category whose gate is "no" (or fields hidden by their own
 * conditions, like the balance of a closed account) never reach a sheet.
 */

const money = (raw: unknown): string => encodeText("money", raw) ?? ""
const date = (raw: unknown): string => encodeText("date", raw) ?? ""
const text = (raw: unknown): string => encodeText("text", raw) ?? ""
const yesNo = (raw: unknown): string => (raw === "yes" || raw === true ? "Yes" : raw === "no" || raw === false ? "No" : "")
const label = (options: readonly (readonly [string, string])[], raw: unknown): string =>
  options.find(([value]) => value === raw)?.[1] ?? ""

interface Category {
  title: string
  columns: string[]
  place: (reader: VisibleReader) => Placement
  /** One sheet row for a row that does not fit the form. */
  cells: (read: (key: string) => unknown) => string[]
}

const CATEGORIES: Category[] = [
  {
    title: "Additional bank accounts",
    columns: [
      "Name on account",
      "Account type",
      "Name of bank/institution",
      "Account number",
      "Current balance ($)",
      "Balance on admission date ($)",
      "Account open or closed",
      "Date account closed",
      "Amount on the date account closed ($)",
    ],
    place: placeBank,
    cells: (read) => [
      text(read("ownerName")),
      accountTypeLabel(read("accountType")) ?? "",
      text(read("institution")),
      text(read("accountNumber")),
      money(read("currentBalance")),
      money(read("balanceOnAdmissionDate")),
      read("open") === true ? "Open" : read("open") === false ? "Closed" : "",
      date(read("closedOn")),
      money(read("balanceWhenClosed")),
    ],
  },
  {
    title: "Additional real estate",
    columns: ["Address", "Type of property", "Current value ($)"],
    place: placeRealEstate,
    cells: (read) => [text(read("address")), propertyTypeLabel(read("propertyType")) ?? "", money(read("currentValue"))],
  },
  {
    title: "Additional life insurance policies",
    columns: ["Name(s) of owner(s)", "Insurance company", "Policy number", "Face value ($)", "Insurance type"],
    place: placeLifeInsurance,
    cells: (read) => [text(read("owners")), text(read("company")), text(read("policyNumber")), money(read("faceValue")), text(read("insuranceType"))],
  },
  {
    title: "Additional securities and brokerage accounts",
    columns: ["Type", "Owner(s) name(s)", "Company name", "Account number", "Current value ($)", "Value on admission date ($)", "Joint asset?"],
    place: placeSecurities,
    cells: (read) => [
      label(SECURITIES_KINDS, read("kind")),
      text(read("owners")),
      text(read("company")),
      text(read("accountNumber")),
      money(read("currentValue")),
      money(read("valueOnAdmissionDate")),
      yesNo(read("joint")),
    ],
  },
  {
    title: "Additional annuities",
    columns: ["Name(s) of owner(s)", "Name of institution issuing the annuity", "Contract number", "Date purchased"],
    place: placeAnnuities,
    cells: (read) => [text(read("owners")), text(read("institution")), text(read("contractNumber")), date(read("purchasedOn"))],
  },
  {
    title: "Additional assisted living and similar deposits",
    columns: ["Name of facility", "Address of facility", "Amount of deposit ($)", "Date deposit given to facility"],
    place: placeDeposits,
    cells: (read) => [text(read("facilityName")), text(read("facilityAddress")), money(read("amount")), date(read("depositedOn"))],
  },
  {
    title: "Additional vehicles and mobile homes",
    columns: ["Owner", "Type of vehicle", "Year/make/model (or mobile home address)", "Fair-market value ($)", "Amount owed ($)"],
    place: placeVehicles,
    cells: (read) => [
      label(OWNERS, read("owner")),
      text(read("vehicleType")),
      text(read("yearMakeModel")),
      money(read("fairMarketValue")),
      money(read("amountOwed")),
    ],
  },
  {
    title: "Additional prepaid burial plans",
    columns: ["Owner", "Type", "Amount ($)"],
    place: placeBurial,
    cells: (read) => [label(OWNERS, read("owner")), label(BURIAL_KINDS, read("kind")), money(read("amount"))],
  },
  {
    title: "Additional trusts",
    columns: [
      "Trust name",
      "Revocable?",
      "Current trust principal ($)",
      "Trust principal on admission date ($)",
      "Trustee(s)",
      "Grantor(s)/Donor(s)",
      "Beneficiaries",
    ],
    place: placeTrusts,
    cells: (read) => [
      text(read("name")),
      yesNo(read("revocable")),
      money(read("currentPrincipal")),
      money(read("principalOnAdmissionDate")),
      text(read("trustees")),
      text(read("grantors")),
      text(read("beneficiaries")),
    ],
  },
]

const readerFor = (reader: VisibleReader, ref: RowRef) => (key: string) => readRow(reader, ref, key)

/** One sheet per Step 5 category that has rows beyond the form's capacity, in the form's order. */
export const assetsCollector: OverflowCollector = (reader) =>
  CATEGORIES.flatMap(({ title, columns, place, cells }): OverflowSheetSpec[] => {
    const { extra } = place(reader)
    return extra.length === 0 ? [] : [{ title, columns, rows: extra.map((ref) => cells(readerFor(reader, ref))) }]
  })

/** Step 4: people requesting payment of previous medical bills beyond the form's two lines. */
export const previousBillsCollector: OverflowCollector = (reader) => {
  const path = "previousMedicalBills.requests"
  const count = reader.rows("previousBills", path)
  const rows: string[][] = []
  for (let index = PREVIOUS_BILLS_LINES; index < count; index += 1) {
    const get = (key: string) => reader.get({ kind: "row", stepId: "previousBills", path, index, key })
    rows.push([text(get("name")), date(get("earliestDateRequested")), yesNo(get("circumstancesChanged"))])
  }
  return rows.length === 0
    ? []
    : [
        {
          title: "Additional previous medical bill requests",
          columns: ["Name", "Earliest date requested", "Any change in circumstances during this time?"],
          rows,
        },
      ]
}
