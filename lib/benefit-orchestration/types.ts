// Cross-Program Benefit Orchestration — Core Types
// Single intake → evaluate all MA safety-net programs simultaneously

import type { CitizenshipStatus } from '../eligibility-engine'

export type { CitizenshipStatus }

export type EmploymentStatus =
  | 'employed'
  | 'self_employed'
  | 'unemployed'
  | 'retired'
  | 'student'
  | 'not_working'

export type HousingStatus =
  | 'renter'
  | 'owner'
  | 'homeless'
  | 'living_with_family'
  | 'shelter'
  | 'other'

export type TaxFilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_widow'

export type UtilityType = 'heat' | 'electricity' | 'gas' | 'oil' | 'wood' | 'other'

export type RelationshipType =
  | 'spouse'
  | 'partner'
  | 'child'
  | 'stepchild'
  | 'parent'
  | 'sibling'
  | 'grandchild'
  | 'grandparent'
  | 'other_relative'
  | 'non_relative'

export type BenefitCategory =
  | 'healthcare'
  | 'food'
  | 'housing'
  | 'childcare'
  | 'utility'
  | 'cash'
  | 'tax_credit'

export type EligibilityStatus = 'likely' | 'possibly' | 'unlikely' | 'ineligible'

export type BenefitProgramId =
  | 'masshealth_standard'
  | 'masshealth_careplus'
  | 'masshealth_family_assistance'
  | 'masshealth_limited'
  | 'masshealth_standard_pregnancy'
  | 'connector_care'
  | 'health_connector_credits'
  | 'msp'
  | 'snap'
  | 'eitc_federal'
  | 'eitc_ma'
  | 'section8_hcv'
  | 'childcare_ccfa'
  | 'liheap'
  | 'wic'
  | 'tafdc'
  | 'eaedc'

// All monetary amounts are monthly unless noted
export interface IncomeBreakdown {
  wages: number           // gross W-2 wages
  selfEmployment: number  // net self-employment income
  unemployment: number    // UI benefits
  socialSecurity: number  // SS retirement / SSDI
  ssi: number             // Supplemental Security Income
  pension: number         // pension / retirement distributions
  rental: number          // net rental income
  interest: number        // interest / dividends
  childSupport: number    // child support received
  alimony: number
  veterans: number        // VA benefits
  other: number
}

export interface AssetBreakdown {
  bankAccounts: number   // checking + savings
  investments: number    // stocks, bonds, retirement accounts
  realEstate: number     // non-primary-home real estate value
  vehicles: number       // vehicle value above DTA threshold ($4,650)
  other: number
}

export interface HouseholdMemberProfile {
  id: string
  firstName?: string
  relationship: RelationshipType
  age: number
  pregnant: boolean
  disabled: boolean
  over65: boolean
  citizenshipStatus: CitizenshipStatus
  hasMedicare: boolean
  income: IncomeBreakdown
  isTaxDependent: boolean    // claimed as dependent on primary's taxes
  isStudent: boolean         // full-time student (relevant for TAFDC)
  isCaringForChild: boolean  // caretaker relative of child in home
}

export interface FamilyProfile {
  id?: string
  applicantId?: string  // links to applicants table

  // ── Primary applicant demographics ──────────────────────────────────────
  age: number
  pregnant: boolean
  dueDate?: string       // ISO date string
  disabled: boolean      // documented disability or SSI/SSDI recipient
  blind: boolean
  over65: boolean

  // ── Insurance ───────────────────────────────────────────────────────────
  hasMedicare: boolean
  hasPrivateInsurance: boolean
  hasEmployerInsurance: boolean

  // ── Identity & residency ────────────────────────────────────────────────
  citizenshipStatus: CitizenshipStatus
  stateResident: boolean  // MA resident
  county?: string         // MA county (for local housing authority lookup)

  // ── Employment & income ─────────────────────────────────────────────────
  employmentStatus: EmploymentStatus
  income: IncomeBreakdown  // primary applicant's income (monthly)

  // ── Assets ──────────────────────────────────────────────────────────────
  assets: AssetBreakdown

  // ── Housing ─────────────────────────────────────────────────────────────
  housingStatus: HousingStatus
  monthlyRent?: number
  utilityTypes: UtilityType[]  // which utilities the household pays

  // ── Tax filing ──────────────────────────────────────────────────────────
  taxFiler: boolean
  filingStatus?: TaxFilingStatus

  // ── Household members (excludes primary applicant) ───────────────────────
  householdMembers: HouseholdMemberProfile[]

  // ── Derived fields (computed by computeDerivedFields before evaluation) ──
  householdSize: number       // primary + members
  childrenUnder5: number      // for WIC
  childrenUnder13: number     // for childcare CCFA
  childrenUnder18: number     // for TAFDC, SNAP categorical
  childrenUnder19: number     // for MassHealth child track

  createdAt?: string
  updatedAt?: string
}

export interface BenefitResult {
  programId: BenefitProgramId
  programName: string
  programShortName: string
  category: BenefitCategory
  administeredBy: string  // e.g., "MA DTA", "MA DPH", "HUD/Local HA"

  eligibilityStatus: EligibilityStatus
  confidence: number       // 0–100
  ineligibleReason?: string

  // ── Estimated value ──────────────────────────────────────────────────────
  estimatedMonthlyValue: number
  estimatedAnnualValue: number
  valueNote: string  // human-readable, e.g., "~$536/month for household of 2"

  // ── Ranking ──────────────────────────────────────────────────────────────
  score: number    // computed by scoring formula
  priority: number // 1 = highest priority in the stack

  // ── Application info ─────────────────────────────────────────────────────
  applicationMethods: ('online' | 'phone' | 'in_person' | 'mail')[]
  applicationUrl?: string
  applicationPhone?: string
  applicationNote?: string
  waitlistWarning?: string

  // ── Requirements ─────────────────────────────────────────────────────────
  keyRequirements: string[]
  requiredDocuments: string[]

  // ── Cross-program bundling ────────────────────────────────────────────────
  bundleWith?: BenefitProgramId[]
  bundleNote?: string

  processingTime: string  // e.g., "2–4 weeks"
  nextSteps: string[]
}

export interface ApplicationBundle {
  bundleId: string
  bundleName: string
  description: string
  programIds: BenefitProgramId[]
  sharedApplicationName: string
  applicationUrl?: string
  applicationPhone?: string
  estimatedTime: string
  totalEstimatedMonthlyValue: number
}

export interface BenefitStack {
  profileId?: string
  generatedAt: string

  // ── Profile summary ───────────────────────────────────────────────────────
  fplPercent: number
  annualFPL: number
  totalMonthlyIncome: number
  householdSize: number

  // ── All results, sorted by priority ──────────────────────────────────────
  results: BenefitResult[]

  // ── Filtered views ────────────────────────────────────────────────────────
  likelyPrograms: BenefitResult[]
  possiblePrograms: BenefitResult[]
  quickWins: BenefitResult[]  // top 3 likely by score (fastest/highest value)

  // ── Estimated total value (likely programs only) ──────────────────────────
  totalEstimatedMonthlyValue: number
  totalEstimatedAnnualValue: number

  // ── Application bundles ───────────────────────────────────────────────────
  bundles: ApplicationBundle[]

  summary: string
}
