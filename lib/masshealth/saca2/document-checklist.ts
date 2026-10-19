/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { SACA2_FIGURES } from "./figures-2026"
import { dollarsToCents, totalCents } from "./eligibility/money"
import { determineRoutes } from "./eligibility/routes"
import type { Saca2DocumentId, Saca2DocumentItem, Saca2EligibilityInputs, Saca2Figures } from "./eligibility/types"

const WORK_KINDS: ReadonlySet<string> = new Set(["wages", "selfEmployment", "farmingFishing"])

/**
 * Documents to gather, derived only from visible answers (spec §4.5 and the form's "send a copy" instructions).
 * Fixed order, no duplicates. A screening aid: MassHealth may ask for more or fewer.
 */
export function buildSaca2DocumentChecklist(inputs: Saca2EligibilityInputs, figures: Saca2Figures = SACA2_FIGURES): Saca2DocumentItem[] {
  const items: Saca2DocumentItem[] = []
  const add = (id: Saca2DocumentId, label: string, reason: string) => {
    if (!items.some((item) => item.id === id)) items.push({ id, label, reason })
  }
  const { assets: a, suppA: s, health, paperwork } = inputs
  // Person 2 exists in the inputs whenever their step is visible, even if they are not a spouse. Only a spouse's
  // or an applicant's answers belong on the list.
  const persons = inputs.persons.filter((p) => p.index === 0 || inputs.hasSpouse || p.applying)
  const applicants = persons.filter((p) => p.applying)
  const kinds = persons.flatMap((p) => p.income.map((line) => line.kind)).filter((kind): kind is string => kind !== null)
  const facility = determineRoutes(inputs).includes("nursingFacility")

  if (kinds.some((kind) => WORK_KINDS.has(kind))) add("payStubs", "Recent pay stubs or business records", "You reported income from work or self-employment.")
  if (kinds.some((kind) => !WORK_KINDS.has(kind))) add("benefitStatements", "Award letters or statements for Social Security, pensions, and other income", "You reported income other than work.")
  if (persons.some((p) => p.rental.length > 0)) add("rentalIncome", "Proof of rental income and expenses (leases, tenant statements, or a tax return)", "You reported rental income.")
  if (a.bankAccounts.length > 0) {
    add(
      "accountStatements",
      facility ? "Statements for every account for the past 60 months" : "Current statements for each account",
      facility ? "Nursing-facility applicants must show 60 months of account history." : "You reported bank or retirement accounts.",
    )
  }
  if (a.primaryResidence.length + a.otherRealEstate.length > 0 || s?.ownsHome === "yes") add("realEstate", "Deeds, current property-tax bills, and proof of any amount owed", "You reported real estate.")
  if (a.lifeInsurance.length > 0) add("lifeInsurance", "The first page of each life-insurance policy", "You reported life insurance.")
  const face = totalCents(a.lifeInsurance.map((policy) => policy.faceValue))
  // A missing or invalid face value cannot be shown to be under the limit, so the letter is requested.
  if (face.missing > 0 || face.invalid > 0 || face.total > dollarsToCents(figures.lifeInsuranceFaceValuePerPerson) * (inputs.hasSpouse ? 2 : 1)) {
    add("cashSurrenderLetter", "A letter from the insurer showing the current cash-surrender value (not needed for term policies)", "Total face value is more than $1,500 per person.")
  }
  if (a.securities.some((holding) => holding.kind !== "cash")) add("securities", "Proof of the current value of stocks, bonds, funds, and other investments", "You reported investments.")
  if (a.annuities > 0) add("annuities", "Each annuity contract and proof of its full value", "You reported an annuity.")
  if (a.trusts.length > 0) add("trusts", "Trust documents, amendments, records of financial activity, and the schedule of beneficiaries", "You reported a trust.")
  if (a.vehicles.length > 0) add("vehicles", "The registration for each vehicle and proof of any loan balance", "You reported a vehicle.")
  if (a.burial > 0) add("burial", "Burial contracts, trust documents, policies, or burial-account statements", "You reported a prepaid burial arrangement.")
  if (a.deposits > 0 || s?.gaveFacilityDeposit === "yes") add("facilityDeposit", "The contract with the facility and any documents about the deposit", "You reported a deposit to a care facility.")
  if (s !== null && s.transfers.length > 0) add("transfers", "Proof of each transfer of income or assets in the past 60 months", "You reported a resource transfer.")
  if (inputs.hasSpouse && s?.spouseExpenses) add("spouseExpenses", "Proof of your spouse's housing costs (rent or mortgage, taxes, insurance, condo or co-op fee)", "Your spouse at home may keep part of your income.")
  if (inputs.hasSpouse && s?.familyAtHome === "yes") add("familyIncome", "Proof of monthly income for each family member living with your spouse", "Family members live with your spouse.")
  if (s !== null && s.ltcPolicies > 0) add("ltcInsurance", "Each long-term-care insurance policy", "You reported long-term-care insurance.")
  if (s !== null && (s.taxReturnsFiled === "bothYears" || s.taxReturnsFiled === "oneYear") && s.hasCopiesOfTaxReturns === "yes") {
    add("taxReturns", "Copies of your federal tax returns for the last two years", "You filed tax returns and have copies.")
  }
  if (paperwork.irs4506Needed) add("irs4506", "A signed IRS Form 4506 (included with the application)", "You filed tax returns but do not have copies.")
  if (s?.paysGuardianshipExpenses === "yes") add("guardianshipExpenses", "Proof of court-ordered guardianship expenses", "You pay guardianship expenses.")
  if (applicants.some((p) => p.citizen === "no" && p.hasEligibleImmigrationStatus === "yes")) add("immigration", "Immigration documents for each noncitizen applying", "Someone applying is not a US citizen.")
  if (applicants.some((p) => p.citizen === "yes" && p.hasMedicareOrSsiOrSsdi !== "yes")) {
    add("citizenshipIdentity", "Proof of US citizenship and identity", "People who get Medicare, SSI, or SSDI usually do not need this.")
  }
  if (health.hasMedicare) add("medicareCard", "The Medicare card for each person with Medicare", "You reported Medicare.")
  if (health.medigapOrPartD || (s?.ltcPolicies ?? 0) > 0) add("premiumBills", "Recent premium bills for Medigap, Part D, or long-term-care insurance", "Premiums can affect what you pay.")
  if (health.employerCoverageSupplement) add("employerCoverage", "Details of the health coverage offered by each job (Supplement D)", "Someone is offered or enrolled in job-based coverage.")
  if (paperwork.signedBy === "authorizedRepresentative") add("ard1122", "A signed Authorized Representative Designation form (ARD-1122)", "An authorized representative will sign.")
  if (paperwork.ardSection === "appointedByLaw") add("legalAuthority", "Proof of legal authority, such as guardianship, conservatorship, or power of attorney", "The representative is appointed by law.")
  return items
}