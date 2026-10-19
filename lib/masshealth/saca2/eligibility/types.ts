/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding, EligibilityRuleResult } from "@/lib/masshealth/types"
import type { SACA2_FIGURES } from "../figures-2026"
import type { AssetCategory, YesNo } from "../types"
import type { AmountInput } from "./money"

type Widen<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T

/** The figures table the engine reads (`SACA2_FIGURES` widened so tests can pass a modified copy). */
export type Saca2Figures = Widen<typeof SACA2_FIGURES>

export const SACA2_RULE_IDS = [
  "SACA2_R1_RESIDENCY_ROUTE",
  "SACA2_R2_CITIZENSHIP",
  "SACA2_R3_ASSETS",
  "SACA2_R4_HOME_EQUITY",
  "SACA2_R5_TRANSFERS",
  "SACA2_R6_INCOME",
  "SACA2_R7_SPOUSAL_ALLOWANCE",
  "SACA2_R8_MEDICARE_MSP",
] as const
export type Saca2RuleId = (typeof SACA2_RULE_IDS)[number]

/** What one rule concludes on its own, before confirmation gating. */
export type Saca2RuleVerdict = "pass" | "fail" | "review" | "documents" | "redirect" | "notApplicable"

export type Saca2ScreeningStatus =
  | "LIKELY_ELIGIBLE"
  | "NEEDS_REVIEW"
  | "LIKELY_INELIGIBLE"
  | "PENDING_DOCUMENTS"
  | "REDIRECT_ACA3"

export type Saca2Route =
  | "senior"
  | "nursingFacility"
  | "hcbsWaiver"
  | "pace"
  | "mixedAgeCouple"
  | "disabledWorking"
  | "commonHealthTenYears"

export interface Saca2IncomeLine {
  kind: string | null
  amount: AmountInput
  frequency: string | null
  isLoss: boolean
}

/** One person block as the wizard shows it. `null` = hidden or unanswered. */
export interface Saca2PersonInputs {
  index: 0 | 1
  age: number | null
  applying: boolean
  resident: YesNo | null
  caregiverOfChildUnder19: YesNo | null
  /** Ages on the screening date of the children listed under the caregiver question (null = no valid date). */
  childAges: Array<number | null>
  citizen: YesNo | null
  hasEligibleImmigrationStatus: YesNo | null
  immigrationStatus: string | null
  hasMedicareOrSsiOrSsdi: YesNo | null
  livesWithPerson1: YesNo | null
  inInstitution: YesNo | null
  hasIncome: YesNo | null
  income: Saca2IncomeLine[]
  rental: Array<{ amount: AmountInput; isLoss: boolean }>
  oneTimeIncomeThisYear: number
}

export const SACA2_TRANSFER_KEYS = ["trust", "income", "assets", "deed", "addedToDeed", "loanOrNote", "annuity"] as const
export type Saca2TransferKey = (typeof SACA2_TRANSFER_KEYS)[number]

export interface Saca2SpouseExpenses {
  rent: AmountInput
  mortgage: AmountInput
  homeownersInsurance: AmountInput
  realEstateTaxes: AmountInput
  condoOrCoopFee: AmountInput
  paysHeat: YesNo | null
  paysUtilities: YesNo | null
}

export interface Saca2SuppAInputs {
  needsNursingFacility: YesNo | null
  applyingHcbsWaiver: YesNo | null
  applyingPace: YesNo | null
  intendsToReturnHome: YesNo | null
  paysGuardianshipExpenses: YesNo | null
  /** Null when the spouse-expense questions are hidden (no facility need, or no Person 2). */
  spouseExpenses: Saca2SpouseExpenses | null
  familyAtHome: YesNo | null
  transferAnswers: Record<Saca2TransferKey, YesNo | null>
  transfers: Array<{ date: string | null; amount: AmountInput }>
  gaveFacilityDeposit: YesNo | null
  ownsHome: YesNo | null
  homes: Array<{ ownershipType: string | null; fairMarketValue: AmountInput }>
  occupants: { spouse: boolean; childUnder21: boolean; disabledChild: boolean; dependentRelative: boolean }
  ltcPolicies: number
  taxReturnsFiled: "bothYears" | "oneYear" | "neither" | null
  hasCopiesOfTaxReturns: YesNo | null
}

export interface Saca2AssetInputs {
  gates: Record<AssetCategory, YesNo | null>
  bankAccounts: Array<{ open: boolean; balance: AmountInput }>
  primaryResidence: AmountInput[]
  otherRealEstate: AmountInput[]
  lifeInsurance: Array<{ faceValue: AmountInput; cashSurrenderValue: AmountInput }>
  securities: Array<{ kind: string | null; value: AmountInput }>
  annuities: number
  deposits: number
  vehicles: Array<{ fairMarketValue: AmountInput; amountOwed: AmountInput }>
  burial: number
  trusts: Array<{ revocable: boolean | null; principal: AmountInput }>
}

export interface Saca2EligibilityInputs {
  /** Person 1, then Person 2 only when the Person 2 step is visible. */
  persons: Saca2PersonInputs[]
  /** `householdHasSpouse`: Person 1's visible married answer is yes and the Person 2 step is visible. */
  hasSpouse: boolean
  /** Community household size: 1, or 2 when the spouse lives with Person 1. */
  householdSize: number
  programs: { masshealthHsn: boolean; longTermCare: boolean; hcbsWaiver: boolean }
  screening: { disabledAndWorkingQualifies: YesNo | null; commonHealthTenYears: YesNo | null }
  /** Null when Supplement A is hidden. */
  suppA: Saca2SuppAInputs | null
  assets: Saca2AssetInputs
  health: { hasMedicare: boolean; medigapOrPartD: boolean; wantsPartBHelp: YesNo | null; employerCoverageSupplement: boolean }
  paperwork: {
    signedBy: "applicant" | "authorizedRepresentative" | "responsibleParty" | null
    ardSection: "applicantDesignates" | "cannotDesignate" | "appointedByLaw" | null
    irs4506Needed: boolean
  }
}

/** Dollar amounts (two decimals). Every value is an estimate, never a decision. */
export interface Saca2Estimates {
  routes: Saca2Route[]
  householdSize: number | null
  monthlyIncome: number | null
  fplPercent: number | null
  incomeLimit: { kind: "fpl100" | "specialIncomeLimit"; monthly: number } | null
  countableAssets: number | null
  assetLimit: number | null
  communitySpouseResource: { min: number; max: number } | null
  homeEquityOverLimit: boolean | null
  transfersInWindow: { count: number; total: number; penaltyDays: number; lookBackStart: string } | null
  spousalAllowance: { mmmna: number; excessShelter: number; allowance: number } | null
  patientPaidAmount: number | null
  partBPremium: number | null
}

export function emptyEstimates(): Saca2Estimates {
  return {
    routes: [],
    householdSize: null,
    monthlyIncome: null,
    fplPercent: null,
    incomeLimit: null,
    countableAssets: null,
    assetLimit: null,
    communitySpouseResource: null,
    homeEquityOverLimit: null,
    transfersInWindow: null,
    spousalAllowance: null,
    patientPaidAmount: null,
    partBPremium: null,
  }
}

export interface Saca2RuleOutcome {
  id: Saca2RuleId
  verdict: Saca2RuleVerdict
  message: string
  findings: EligibilityFinding[]
  estimates: Partial<Saca2Estimates>
}

export interface Saca2RuleReport {
  id: Saca2RuleId
  label: string
  /** From the policy registry; false until a named reviewer confirms the rule (rules 3–7). */
  confirmed: boolean
  verdict: Saca2RuleVerdict
  /** The verdict after gating: an unconfirmed pass / fail / documents becomes review. */
  effective_verdict: Saca2RuleVerdict
}

export type Saca2DocumentId =
  | "payStubs"
  | "benefitStatements"
  | "rentalIncome"
  | "accountStatements"
  | "realEstate"
  | "lifeInsurance"
  | "cashSurrenderLetter"
  | "securities"
  | "annuities"
  | "trusts"
  | "vehicles"
  | "burial"
  | "facilityDeposit"
  | "transfers"
  | "spouseExpenses"
  | "familyIncome"
  | "ltcInsurance"
  | "taxReturns"
  | "irs4506"
  | "guardianshipExpenses"
  | "immigration"
  | "citizenshipIdentity"
  | "medicareCard"
  | "premiumBills"
  | "employerCoverage"
  | "ard1122"
  | "legalAuthority"

export interface Saca2DocumentItem {
  id: Saca2DocumentId
  label: string
  reason: string
}

export interface Saca2EligibilityResult {
  status: Saca2ScreeningStatus
  screening_label: string
  findings: EligibilityFinding[]
  rule_results: EligibilityRuleResult[]
  rules: Saca2RuleReport[]
  estimates: Saca2Estimates
  required_documents: string[]
  document_checklist: Saca2DocumentItem[]
  /** Present only for REDIRECT_ACA3: the application chooser with ACA-3 highlighted (no applicant data). */
  redirect_href?: string
}
