/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Pure mapping functions that transform wizard state into downstream shapes:
 *   • MassHealthAcaPayload  — PDF generation
 *   • Aca3EligibilityApplicantInput — eligibility engine
 *
 * All functions are side-effect-free and independently unit-testable.
 */

import { parseCurrency } from "@/lib/utils/input-format"
import { toMonthlyIncome } from "@/lib/utils/aca3-form"
import {
  computeAgeFromDob,
  countDependentsFromRows,
  splitFullName,
  toAnnualAmount,
  toBooleanYesNo,
} from "@/lib/utils/aca3-form"
import {
  type Aca3CitizenshipStatus,
  type Aca3EligibilityApplicantInput,
  type EligibilityIncomeInput,
} from "@/lib/masshealth/aca3-eligibility-engine"
import type { MassHealthAcaPayload } from "@/lib/pdf/masshealth-aca-payload"
import type { FieldValue, FormRecord, WizardData } from "./types"
import { clampPersonCount, makeDefaultPersonState } from "./wizard-reducer"

// ── PDF payload ───────────────────────────────────────────────────────────────

export interface Aca3AnalysisWorkflowPerson {
  personNumber: number
  ss_identity: FormRecord
  ss_demographics: FormRecord
  ss_ssn: FormRecord
  ss_tax: FormRecord
  ss_coverage: FormRecord
  ss_income: FormRecord
}

export interface Aca3AnalysisWorkflowData {
  form_id: "ACA-3"
  form_version: "03/25"
  attestation: boolean
  assisterEnabled: boolean
  pre_application: FormRecord
  enrollment_assister: FormRecord
  step1_contact: FormRecord
  persons: Aca3AnalysisWorkflowPerson[]
}

function cloneFormRecord(record: FormRecord): FormRecord {
  return { ...record }
}

function setIfMissing(record: FormRecord, key: string, value: FieldValue | undefined): void {
  if (record[key] === undefined || record[key] === null || record[key] === "") {
    if (value !== undefined && value !== null && value !== "") {
      record[key] = value
    }
  }
}

export function mapWizardToAnalysisWorkflowData(data: WizardData): Aca3AnalysisWorkflowData {
  return {
    form_id: "ACA-3",
    form_version: "03/25",
    attestation: data.attestation,
    assisterEnabled: data.assisterEnabled,
    pre_application: cloneFormRecord(data.preApp),
    enrollment_assister: data.assisterEnabled ? cloneFormRecord(data.assister) : {},
    step1_contact: cloneFormRecord(data.contact),
    persons: data.persons.map((person, index) => {
      const identity = cloneFormRecord(person.identity)

      if (index === 0) {
        setIfMissing(identity, "name", data.contact.p1_name)
        setIfMissing(identity, "dob", data.contact.p1_dob)
      }

      return {
        personNumber: index + 1,
        ss_identity: identity,
        ss_demographics: cloneFormRecord(person.demographics),
        ss_ssn: cloneFormRecord(person.ssn),
        ss_tax: cloneFormRecord(person.tax),
        ss_coverage: cloneFormRecord(person.coverage),
        ss_income: cloneFormRecord(person.income),
      }
    }),
  }
}

export function mapWizardToPdfPayload(data: WizardData): MassHealthAcaPayload {
  const primary = data.persons[0] ?? makeDefaultPersonState(0)
  const { firstName, lastName } = splitFullName(String(data.contact.p1_name ?? ""))
  const homeState = String(data.contact.p1_home_state ?? "MA").trim().toUpperCase() || "MA"
  const homeZip = String(data.contact.p1_home_zip ?? "").replace(/\D/g, "").slice(0, 5)
  const householdSize = clampPersonCount(data.contact.p1_num_people || data.persons.length || 1)
  const firstJob = Array.isArray(primary.income.employment_jobs)
    ? (primary.income.employment_jobs[0] as Record<string, unknown> | undefined)
    : undefined
  const wagesAmount = parseCurrency(String(firstJob?.wages_amount ?? ""))
  const wagesFrequency = String(firstJob?.wages_frequency ?? "")
  const monthlyIncome = toMonthlyIncome(wagesAmount, wagesFrequency)
  const annualIncomeFromField = parseCurrency(String(primary.income.total_income_current_year ?? ""))
  const annualIncome = annualIncomeFromField > 0 ? annualIncomeFromField : monthlyIncome * 12
  const citizenship: MassHealthAcaPayload["citizenship"] =
    String(primary.coverage.us_citizen ?? "") === "Yes" ? "citizen" : "other"

  return {
    firstName,
    lastName,
    dateOfBirth: String(data.contact.p1_dob ?? ""),
    email: String(data.contact.p1_email ?? ""),
    ssn: String(primary.ssn.ssn ?? ""),
    streetAddress: String(data.contact.p1_home_street ?? ""),
    apartment: String(data.contact.p1_home_apt ?? ""),
    city: String(data.contact.p1_home_city ?? ""),
    state: homeState,
    zipCode: homeZip,
    county: String(data.contact.p1_home_county ?? ""),
    phone: String(data.contact.p1_phone ?? ""),
    otherPhone: String(data.contact.p1_other_phone ?? ""),
    householdSize,
    citizenship,
    preferredSpokenLanguage: String(data.contact.p1_language_spoken ?? ""),
    preferredWrittenLanguage: String(data.contact.p1_language_written ?? ""),
    employerName: String(firstJob?.employer_name_address ?? ""),
    monthlyIncome,
    annualIncome,
    weeklyHours: Number.parseFloat(String(firstJob?.hours_per_week ?? "0")) || undefined,
    signatureName: String(data.contact.p1_name ?? ""),
    signatureDate: new Date().toISOString().slice(0, 10),
  }
}

// ── Citizenship inference ─────────────────────────────────────────────────────

export function inferCitizenshipStatus(primaryCoverage: FormRecord): Aca3CitizenshipStatus {
  if (toBooleanYesNo(primaryCoverage.us_citizen)) return "US_CITIZEN"

  if (toBooleanYesNo(primaryCoverage.eligible_immigration_status)) {
    const immigrationText = String(primaryCoverage.immigration_status_type ?? "")
      .trim()
      .toLowerCase()

    if (immigrationText.includes("refugee")) return "REFUGEE"
    if (immigrationText.includes("asylee")) return "ASYLEE"
    if (
      immigrationText.includes("temporary protected status") ||
      immigrationText.includes("tps")
    ) return "TPS"
    if (immigrationText.includes("permanent")) return "LEGAL_PERMANENT_RESIDENT"
    return "QUALIFIED_NONCITIZEN"
  }

  return "UNDOCUMENTED"
}

// ── Eligibility input ─────────────────────────────────────────────────────────

export function mapWizardToEligibilityInput(
  data: WizardData,
  incomeVerifiedOverride: boolean,
): Aca3EligibilityApplicantInput {
  const person1 = data.persons[0] ?? makeDefaultPersonState(0)
  const coverage = person1.coverage
  const tax = person1.tax
  const ssn = person1.ssn
  const incomeSection = person1.income
  const contact = data.contact

  const jobs = Array.isArray(incomeSection.employment_jobs)
    ? (incomeSection.employment_jobs as Array<Record<string, unknown>>)
    : []
  const wagesAnnual = jobs.reduce((sum, job) => {
    const amount = parseCurrency(String(job.wages_amount ?? ""))
    const frequency = String(job.wages_frequency ?? "")
    return sum + toAnnualAmount(amount, frequency)
  }, 0)

  const selfEmploymentRaw = parseCurrency(String(incomeSection.self_employment_net_income ?? ""))
  const selfEmploymentProfitLoss = String(incomeSection.self_employment_profit_loss ?? "")
    .trim()
    .toLowerCase()
  const selfEmploymentAnnual =
    selfEmploymentProfitLoss === "loss"
      ? -toAnnualAmount(selfEmploymentRaw, "monthly")
      : toAnnualAmount(selfEmploymentRaw, "monthly")

  const otherIncomeChecklist =
    (incomeSection.other_income as Record<string, Record<string, unknown>>) ?? {}
  const resolveChecklistAnnual = (id: string): number => {
    const item = otherIncomeChecklist[id]
    if (!item || !item.selected) return 0
    return toAnnualAmount(parseCurrency(String(item.amount ?? "")), String(item.frequency ?? ""))
  }

  const directAnnualTotal = parseCurrency(String(incomeSection.total_income_current_year ?? ""))

  const incomeInput: EligibilityIncomeInput = {
    wages: wagesAnnual,
    selfEmployment: selfEmploymentAnnual,
    unemployment: resolveChecklistAnnual("inc_unemployment"),
    socialSecurityTaxable: resolveChecklistAnnual("inc_social_security"),
    rentalIncome: resolveChecklistAnnual("inc_rental_royalty"),
    interest: resolveChecklistAnnual("inc_investment"),
    pension: resolveChecklistAnnual("inc_retirement_pension"),
  }

  const claimDependents = toBooleanYesNo(tax.claim_dependents)
  const dependentsCount = claimDependents
    ? countDependentsFromRows(tax.dependents_list__rows ?? tax.dependents_list)
    : 0
  const unbornChildren = toBooleanYesNo(coverage.is_pregnant)
    ? Number.parseInt(String(coverage.num_babies ?? "0"), 10) || 0
    : 0
  const ssnDigits = String(ssn.ssn ?? "").replace(/\D/g, "")
  const hasSsn = toBooleanYesNo(ssn.has_ssn)
  const applicantId = `ACA3-${String(contact.p1_name ?? "APPLICANT")
    .trim()
    .replace(/\s+/g, "-")
    .toUpperCase()}`

  return {
    applicantId,
    age: computeAgeFromDob(String(contact.p1_dob ?? "")),
    stateResident: toBooleanYesNo(coverage.ma_resident)
      ? "MA"
      : String(contact.p1_home_state ?? "").trim().toUpperCase(),
    identityVerified: hasSsn && ssnDigits.length === 9,
    citizenshipStatus: inferCitizenshipStatus(coverage),
    married: toBooleanYesNo(tax.legally_married),
    taxDependents: dependentsCount,
    taxFiler: toBooleanYesNo(tax.aptc_agree),
    pregnant: toBooleanYesNo(coverage.is_pregnant),
    unbornChildren,
    disabled: toBooleanYesNo(coverage.has_disability),
    medicalVerification: true,
    hasOtherInsurance: false,
    income:
      directAnnualTotal > 0
        ? { ...incomeInput, wages: directAnnualTotal }
        : incomeInput,
    verification: {
      ssnVerified: hasSsn && ssnDigits.length === 9,
      incomeVerified: incomeVerifiedOverride,
      immigrationVerified:
        toBooleanYesNo(coverage.us_citizen) ||
        toBooleanYesNo(coverage.eligible_immigration_status),
    },
  }
}
