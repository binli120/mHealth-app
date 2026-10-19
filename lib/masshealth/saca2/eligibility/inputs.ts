/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { calculateAge } from "../age"
import { householdHasSpouse } from "../pdf/derived-assets"
import { createVisibleReader, type VisibleReader } from "../pdf/visible-reader"
import type { Saca2StepId } from "../schema"
import type { AssetCategory, Saca2Answers, YesNo } from "../types"
import { isStepVisible } from "../visibility"
import { toCents } from "./money"
import {
  SACA2_TRANSFER_KEYS,
  type Saca2AssetInputs,
  type Saca2EligibilityInputs,
  type Saca2PersonInputs,
  type Saca2SuppAInputs,
  type Saca2TransferKey,
} from "./types"

const ASSET_CATEGORIES: readonly AssetCategory[] = [
  "bankAccounts",
  "retirementAccounts",
  "closedAccounts",
  "primaryResidence",
  "otherRealEstate",
  "lifeInsurance",
  "securities",
  "annuities",
  "assistedLivingDeposit",
  "vehicles",
  "burial",
  "trusts",
]

interface View {
  answer(path: string): unknown
  rows(path: string): number
  cell(path: string, index: number, key: string): unknown
}

function rootView(reader: VisibleReader, stepId: Saca2StepId): View {
  return {
    answer: (path) => reader.get({ kind: "answer", stepId, path }),
    rows: (path) => reader.rows(stepId, path),
    cell: (path, index, key) => reader.get({ kind: "row", stepId, path, index, key }),
  }
}

/** Person blocks share one content table; `person` selects the block and its step gate. */
function personView(reader: VisibleReader, person: 0 | 1): View {
  return {
    answer: (path) => reader.get({ kind: "answer", stepId: "person1", path, person }),
    rows: (path) => reader.rows("person1", path, person),
    cell: (path, index, key) => reader.get({ kind: "row", stepId: "person1", path, index, key, person }),
  }
}

const yesNo = (value: unknown): YesNo | null => (value === "yes" || value === "no" ? value : null)
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null)
const indexes = (count: number): number[] => Array.from({ length: count }, (_, index) => index)

function readPerson(reader: VisibleReader, index: 0 | 1, on: Date): Saca2PersonInputs {
  const p = personView(reader, index)
  return {
    index,
    age: calculateAge(text(p.answer("dateOfBirth")), on),
    applying: p.answer("applyingForCoverage") === "yes",
    resident: yesNo(p.answer("residentOfMassachusetts")),
    caregiverOfChildUnder19: yesNo(p.answer("caregiverOfChildUnder19")),
    childAges: indexes(p.rows("caregiverChildren")).map((i) => calculateAge(text(p.cell("caregiverChildren", i, "dateOfBirth")), on)),
    citizen: yesNo(p.answer("usCitizenOrNational")),
    hasEligibleImmigrationStatus: yesNo(p.answer("hasEligibleImmigrationStatus")),
    immigrationStatus: text(p.answer("immigrationStatus")),
    hasMedicareOrSsiOrSsdi: yesNo(p.answer("hasMedicareOrSsiOrSsdi")),
    livesWithPerson1: yesNo(p.answer("livesWithPerson1")),
    inInstitution: yesNo(p.answer("inInstitution")),
    hasIncome: yesNo(p.answer("hasIncome")),
    income: indexes(p.rows("income")).map((i) => ({
      kind: text(p.cell("income", i, "kind")),
      amount: toCents(p.cell("income", i, "amount")),
      frequency: text(p.cell("income", i, "frequency")),
      isLoss: p.cell("income", i, "isLoss") === true,
    })),
    rental: indexes(p.rows("rental.units")).map((i) => ({
      amount: toCents(p.cell("rental.units", i, "amount")),
      isLoss: p.cell("rental.units", i, "isLoss") === true,
    })),
    oneTimeIncomeThisYear: p.rows("oneTimeIncome.thisYearItems"),
  }
}

function readSuppA(reader: VisibleReader, answers: Saca2Answers, on: Date): Saca2SuppAInputs | null {
  if (!isStepVisible("suppA", answers, on)) return null
  const s = rootView(reader, "suppA")
  const a = (path: string) => s.answer(`supplements.a.${path}`)
  const expensesShown = reader.isVisible({ kind: "answer", stepId: "suppA", path: "supplements.a.spouseMonthlyExpenses.paysHeat" })
  const livesInHome = (key: string) => a(`home.${key}.livesInHome`) === "yes"
  const filed = a("taxReturnsFiled")
  const HOMES = "supplements.a.home.properties"
  return {
    needsNursingFacility: yesNo(a("needsNursingFacility")),
    applyingHcbsWaiver: yesNo(a("applyingHcbsWaiver")),
    applyingPace: yesNo(a("applyingPace")),
    intendsToReturnHome: yesNo(a("intendsToReturnHome")),
    paysGuardianshipExpenses: yesNo(a("facility.paysGuardianshipExpenses")),
    spouseExpenses: expensesShown
      ? {
          rent: toCents(a("spouseMonthlyExpenses.rent")),
          mortgage: toCents(a("spouseMonthlyExpenses.mortgage")),
          homeownersInsurance: toCents(a("spouseMonthlyExpenses.homeownersInsurance")),
          realEstateTaxes: toCents(a("spouseMonthlyExpenses.realEstateTaxes")),
          condoOrCoopFee: toCents(a("spouseMonthlyExpenses.condoOrCoopFee")),
          paysHeat: yesNo(a("spouseMonthlyExpenses.paysHeat")),
          paysUtilities: yesNo(a("spouseMonthlyExpenses.paysUtilities")),
        }
      : null,
    familyAtHome: yesNo(a("familyAtHome.hasFamily")),
    transferAnswers: Object.fromEntries(
      SACA2_TRANSFER_KEYS.map((key) => [key, yesNo(a(`transferAnswers.${key}`))]),
    ) as Record<Saca2TransferKey, YesNo | null>,
    transfers: indexes(s.rows("transfers")).map((i) => ({
      date: text(s.cell("transfers", i, "dateOfTransfer")),
      amount: toCents(s.cell("transfers", i, "amount")),
    })),
    gaveFacilityDeposit: yesNo(a("facilityDeposit.gaveDeposit")),
    ownsHome: yesNo(a("home.ownsHome")),
    homes: indexes(s.rows(HOMES)).map((i) => ({
      ownershipType: text(s.cell(HOMES, i, "ownershipType")),
      fairMarketValue: toCents(s.cell(HOMES, i, "fairMarketValue")),
    })),
    occupants: {
      spouse: livesInHome("spouse"),
      childUnder21: livesInHome("childUnder21"),
      disabledChild: livesInHome("disabledChild"),
      dependentRelative: livesInHome("dependentRelative"),
    },
    ltcPolicies: s.rows("supplements.a.longTermCareInsurance.policies"),
    taxReturnsFiled: filed === "bothYears" || filed === "oneYear" || filed === "neither" ? filed : null,
    hasCopiesOfTaxReturns: yesNo(a("hasCopiesOfTaxReturns")),
  }
}

function readAssets(reader: VisibleReader): Saca2AssetInputs {
  const s = rootView(reader, "assets")
  const each = <T>(path: string, read: (i: number) => T): T[] => indexes(s.rows(path)).map(read)
  return {
    gates: Object.fromEntries(
      ASSET_CATEGORIES.map((category) => [category, yesNo(s.answer(`assets.gates.${category}`))]),
    ) as Record<AssetCategory, YesNo | null>,
    bankAccounts: each("assets.bankAccounts", (i) => ({
      open: s.cell("assets.bankAccounts", i, "open") !== false,
      balance: toCents(s.cell("assets.bankAccounts", i, "currentBalance")),
    })),
    primaryResidence: each("assets.primaryResidence", (i) => toCents(s.cell("assets.primaryResidence", i, "currentValue"))),
    otherRealEstate: each("assets.otherRealEstate", (i) => toCents(s.cell("assets.otherRealEstate", i, "currentValue"))),
    lifeInsurance: each("assets.lifeInsurance", (i) => ({
      faceValue: toCents(s.cell("assets.lifeInsurance", i, "faceValue")),
      cashSurrenderValue: toCents(s.cell("assets.lifeInsurance", i, "cashSurrenderValue")),
    })),
    securities: each("assets.securities", (i) => ({
      kind: text(s.cell("assets.securities", i, "kind")),
      value: toCents(s.cell("assets.securities", i, "currentValue")),
    })),
    annuities: s.rows("assets.annuities"),
    deposits: s.rows("assets.assistedLivingDeposits"),
    vehicles: each("assets.vehicles", (i) => ({
      fairMarketValue: toCents(s.cell("assets.vehicles", i, "fairMarketValue")),
      amountOwed: toCents(s.cell("assets.vehicles", i, "amountOwed")),
    })),
    burial: s.rows("assets.burial"),
    trusts: each("assets.trusts", (i) => {
      const revocable = s.cell("assets.trusts", i, "revocable")
      return {
        revocable: typeof revocable === "boolean" ? revocable : null,
        principal: toCents(s.cell("assets.trusts", i, "currentPrincipal")),
      }
    }),
  }
}

/**
 * The answers every screening rule may use, read exactly as the wizard shows them: a value is present only
 * when its step, person block, question (and repeater row) are visible, so stale answers behind a flipped
 * gate never change a result. Spouse-side values exist only when `householdHasSpouse` holds. Throws only on
 * a mapping bug (unknown path); the engine turns that into a NEEDS_REVIEW fallback.
 */
export function readSaca2EligibilityInputs(answers: Saca2Answers, on: Date): Saca2EligibilityInputs {
  const reader = createVisibleReader(answers, on)
  const persons: Saca2PersonInputs[] = [readPerson(reader, 0, on)]
  if (isStepVisible("person2", answers, on) && answers.persons[1] !== undefined) persons.push(readPerson(reader, 1, on))
  const hasSpouse = householdHasSpouse(reader, answers, on)
  const spouse = hasSpouse ? persons[1] : undefined
  const intake = rootView(reader, "intake")
  const health = rootView(reader, "healthInsurance")
  const medicareRows = indexes(health.rows("health.medicare"))
  const signedBy = reader.get({ kind: "answer", stepId: "signature", path: "signature.signedBy" })
  const ardSection = reader.get({ kind: "answer", stepId: "ard", path: "attachments.ard.section" })
  return {
    persons,
    hasSpouse,
    householdSize: 1 + (spouse?.livesWithPerson1 === "yes" ? 1 : 0),
    programs: {
      masshealthHsn: intake.answer("intake.programs.masshealthHsn") === true,
      longTermCare: intake.answer("intake.programs.longTermCare") === true,
      hcbsWaiver: intake.answer("intake.programs.hcbsWaiver") === true,
    },
    screening: {
      disabledAndWorkingQualifies: yesNo(intake.answer("screening.disabledAndWorkingQualifies")),
      commonHealthTenYears: yesNo(intake.answer("screening.commonHealthTenYears")),
    },
    suppA: readSuppA(reader, answers, on),
    assets: readAssets(reader),
    health: {
      hasMedicare: health.answer("health.hasMedicare") === true,
      medigapOrPartD: medicareRows.some(
        (i) => health.cell("health.medicare", i, "hasPartD") === "yes" || health.cell("health.medicare", i, "hasMedigap") === "yes",
      ),
      wantsPartBHelp: yesNo(health.answer("health.wantsPartBHelp")),
      employerCoverageSupplement: isStepVisible("suppD", answers, on),
    },
    paperwork: {
      signedBy:
        signedBy === "applicant" || signedBy === "authorizedRepresentative" || signedBy === "responsibleParty" ? signedBy : null,
      ardSection:
        ardSection === "applicantDesignates" || ardSection === "cannotDesignate" || ardSection === "appointedByLaw" ? ardSection : null,
      irs4506Needed: isStepVisible("irs4506", answers, on),
    },
  }
}
