/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

/**
 * Application-level business rule checks run after PDF extraction or manual entry.
 *
 * Covers:
 *   1. Income fields internally consistent
 *   2. SSNs present for all applying household members
 *   3. Immigration status documented for non-citizens
 *   4. Required supplements identified (ACA-3-AP for 4+ person households)
 *   5. Dates of birth consistent with program thresholds
 */

import { parseCurrency } from "@/lib/utils/input-format"
import { computeAgeFromDob, toAnnualAmount, toBooleanYesNo } from "@/lib/utils/aca3-form"

export type CheckSeverity = "error" | "warning" | "info"

export type CheckCategory =
  | "income_consistency"
  | "ssn_coverage"
  | "immigration_status"
  | "form_supplements"
  | "age_thresholds"

export interface ApplicationCheckResult {
  id: string
  severity: CheckSeverity
  category: CheckCategory
  personLabel?: string
  title: string
  message: string
}

/** Minimal shape of person data needed for checks — structurally compatible with PersonState. */
interface PersonCheckData {
  identity: Record<string, unknown>
  ssn: Record<string, unknown>
  coverage: Record<string, unknown>
  income: Record<string, unknown>
}

export interface ApplicationCheckInput {
  /** Flat map of contact/step-1 fields (p1_name, p1_dob, etc.) */
  contact: Record<string, unknown>
  /** One entry per household member; index 0 is the primary applicant. */
  persons: PersonCheckData[]
  /** Form variant detected from extracted PDF, e.g. "aca3" | "aca3ap". */
  detectedFormVariant?: string
}

const SSN_REGEX = /^\d{3}-\d{2}-\d{4}$/

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPersonLabel(data: ApplicationCheckInput, index: number): string {
  if (index === 0) {
    const name = String(data.contact.p1_name ?? "").trim()
    return name || "Primary Applicant"
  }

  const person = data.persons[index]
  const name = String(person?.identity?.name ?? "").trim()
  return name || `Household Member ${index + 1}`
}

// ── Check 1: Income consistency ───────────────────────────────────────────────

function checkIncomeConsistency(
  data: ApplicationCheckInput,
  personCount: number,
  results: ApplicationCheckResult[],
): void {
  for (let i = 0; i < personCount; i++) {
    const person = data.persons[i]
    if (!person) continue

    const income = person.income
    const personLabel = getPersonLabel(data, i)

    if (!toBooleanYesNo(income.has_income)) continue

    // Employment jobs: each selected job needs amount + frequency
    const jobs = Array.isArray(income.employment_jobs)
      ? (income.employment_jobs as Record<string, unknown>[])
      : []

    jobs.forEach((job, jobIdx) => {
      const amount = parseCurrency(String(job.wages_amount ?? ""))
      const frequency = String(job.wages_frequency ?? "").trim()

      if (amount > 0 && !frequency) {
        results.push({
          id: `income.${i}.job.${jobIdx}.frequency`,
          severity: "error",
          category: "income_consistency",
          personLabel,
          title: "Missing pay frequency",
          message: `${personLabel}: Employment entry ${jobIdx + 1} has a wage amount but no pay frequency selected.`,
        })
      }

      if (!amount && frequency) {
        results.push({
          id: `income.${i}.job.${jobIdx}.amount`,
          severity: "warning",
          category: "income_consistency",
          personLabel,
          title: "Missing wage amount",
          message: `${personLabel}: Employment entry ${jobIdx + 1} has a pay frequency selected but no wage amount entered.`,
        })
      }
    })

    // Other income checklist: selected items need amount + frequency
    const otherIncome = (income.other_income ?? {}) as Record<string, Record<string, unknown>>
    for (const [itemId, itemValue] of Object.entries(otherIncome)) {
      if (!itemValue?.selected) continue

      const amount = parseCurrency(String(itemValue.amount ?? ""))
      const frequency = String(itemValue.frequency ?? "").trim()

      if (!amount || !frequency) {
        results.push({
          id: `income.${i}.other.${itemId}`,
          severity: "error",
          category: "income_consistency",
          personLabel,
          title: "Incomplete other income entry",
          message: `${personLabel}: Other income "${itemId.replace(/_/g, " ")}" is selected but is missing ${!amount ? "amount" : "frequency"}.`,
        })
      }
    }

    // Cross-check: reported total vs. computed sum from sources (> 20% discrepancy = warning)
    const reportedTotal = parseCurrency(String(income.total_income_current_year ?? ""))
    if (reportedTotal > 0) {
      let computedAnnual = jobs.reduce((sum, job) => {
        return (
          sum + toAnnualAmount(parseCurrency(String(job.wages_amount ?? "")), String(job.wages_frequency ?? ""))
        )
      }, 0)

      for (const itemValue of Object.values(otherIncome)) {
        if (!itemValue?.selected) continue
        computedAnnual += toAnnualAmount(
          parseCurrency(String(itemValue.amount ?? "")),
          String(itemValue.frequency ?? ""),
        )
      }

      if (computedAnnual > 0) {
        const discrepancy =
          Math.abs(reportedTotal - computedAnnual) / Math.max(reportedTotal, computedAnnual)
        if (discrepancy > 0.2) {
          results.push({
            id: `income.${i}.total_mismatch`,
            severity: "warning",
            category: "income_consistency",
            personLabel,
            title: "Annual income total may be inconsistent",
            message: `${personLabel}: Reported annual total $${reportedTotal.toLocaleString()} differs from the sum of listed income sources ($${Math.round(computedAnnual).toLocaleString()}) by more than 20%. Review both figures.`,
          })
        }
      }
    }
  }
}

// ── Check 2: SSN for applying members ────────────────────────────────────────

function checkSsnCoverage(
  data: ApplicationCheckInput,
  personCount: number,
  results: ApplicationCheckResult[],
): void {
  for (let i = 0; i < personCount; i++) {
    const person = data.persons[i]
    if (!person) continue

    const personLabel = getPersonLabel(data, i)
    const isApplying = toBooleanYesNo(person.coverage.applying_for_coverage)

    if (!isApplying) continue

    const hasSsnRaw = String(person.ssn.has_ssn ?? "").trim().toLowerCase()
    const explicitlyNoSsn = hasSsnRaw === "no"

    if (explicitlyNoSsn) {
      // Documented as having no SSN — check that a reason is provided
      const noSsnReason = String(person.ssn.no_ssn_reason ?? "").trim()
      if (!noSsnReason) {
        results.push({
          id: `ssn.${i}.no_reason`,
          severity: "warning",
          category: "ssn_coverage",
          personLabel,
          title: "No SSN — reason not documented",
          message: `${personLabel} indicated they have no SSN but no exception reason (e.g. noncitizen exception, just applied) was selected.`,
        })
      }
      continue
    }

    const ssnValue = String(person.ssn.ssn ?? "").trim()

    if (!ssnValue) {
      results.push({
        id: `ssn.${i}.missing`,
        severity: "error",
        category: "ssn_coverage",
        personLabel,
        title: "SSN missing for applying member",
        message: `${personLabel} is applying for coverage but no SSN was entered. If they do not have an SSN, indicate that in the SSN section.`,
      })
    } else if (!SSN_REGEX.test(ssnValue)) {
      results.push({
        id: `ssn.${i}.invalid_format`,
        severity: "warning",
        category: "ssn_coverage",
        personLabel,
        title: "SSN format may be incorrect",
        message: `${personLabel}: SSN does not match the expected ###-##-#### format. Verify the number is correct.`,
      })
    }
  }
}

// ── Check 3: Immigration status documented ────────────────────────────────────

function checkImmigrationStatus(
  data: ApplicationCheckInput,
  personCount: number,
  results: ApplicationCheckResult[],
): void {
  for (let i = 0; i < personCount; i++) {
    const person = data.persons[i]
    if (!person) continue

    const personLabel = getPersonLabel(data, i)
    const isCitizen = toBooleanYesNo(person.coverage.us_citizen)

    if (isCitizen) continue

    const immigrationStatus = String(person.coverage.eligible_immigration_status ?? "").trim()

    if (!immigrationStatus) {
      results.push({
        id: `immigration.${i}.missing`,
        severity: "error",
        category: "immigration_status",
        personLabel,
        title: "Immigration status not documented",
        message: `${personLabel} is not marked as a US citizen. The "Eligible immigration status" field must be completed in the coverage section.`,
      })
    }
  }
}

// ── Check 4: Required supplements ────────────────────────────────────────────

function checkRequiredSupplements(
  data: ApplicationCheckInput,
  personCount: number,
  results: ApplicationCheckResult[],
): void {
  if (personCount < 4) return

  const variant = (data.detectedFormVariant ?? "").toLowerCase().replace(/[-\s]/g, "")
  const hasAp = variant.includes("aca3ap") || variant.includes("acaap")

  if (!variant) {
    // Unknown form variant — cannot confirm supplement
    results.push({
      id: "supplements.aca3ap.unknown",
      severity: "info",
      category: "form_supplements",
      title: "Verify ACA-3-AP supplement",
      message: `This household has ${personCount} members. Confirm that the ACA-3-AP (Additional Persons) supplement is attached — it is required for households of 4 or more.`,
    })
  } else if (!hasAp) {
    results.push({
      id: "supplements.aca3ap.missing",
      severity: "warning",
      category: "form_supplements",
      title: "ACA-3-AP supplement appears missing",
      message: `This household has ${personCount} members but the ACA-3-AP (Additional Persons) supplement does not appear to be attached. This supplement is required for households of 4 or more people.`,
    })
  }
}

// ── Check 5: Age / DOB thresholds ─────────────────────────────────────────────

function checkAgeThresholds(
  data: ApplicationCheckInput,
  personCount: number,
  results: ApplicationCheckResult[],
): void {
  for (let i = 0; i < personCount; i++) {
    const person = data.persons[i]
    if (!person) continue

    const personLabel = getPersonLabel(data, i)

    // Person 0's DOB lives in contact (p1_dob); additional persons use identity.dob
    const dob =
      i === 0 ? String(data.contact.p1_dob ?? "").trim() : String(person.identity.dob ?? "").trim()

    if (!dob) continue

    const age = computeAgeFromDob(dob)

    if (age <= 0 || age > 120) {
      results.push({
        id: `age.${i}.invalid`,
        severity: "error",
        category: "age_thresholds",
        personLabel,
        title: "Date of birth appears invalid",
        message: `${personLabel}: Date of birth "${dob}" produces an unrealistic age (${age}). Please verify the date is correct (MM/DD/YYYY).`,
      })
      continue
    }

    const isApplying = toBooleanYesNo(person.coverage.applying_for_coverage)

    if (age >= 65 && isApplying) {
      results.push({
        id: `age.${i}.senior`,
        severity: "warning",
        category: "age_thresholds",
        personLabel,
        title: "Senior applicant — verify form type",
        message: `${personLabel} is ${age} years old. Seniors (65+) applying for coverage may need form SACA-2 (long-term care / nursing home) or an MSP application (Medicare Savings Programs) instead of or in addition to the ACA-3.`,
      })
    }

    if (age < 19 && isApplying) {
      results.push({
        id: `age.${i}.minor`,
        severity: "info",
        category: "age_thresholds",
        personLabel,
        title: "Minor applicant — confirm program track",
        message: `${personLabel} is ${age} year${age !== 1 ? "s" : ""} old. Children under 19 may qualify for MassHealth Standard or MassHealth CHIP. Confirm the correct program track is selected.`,
      })
    }
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Runs all five business-rule checks against extracted or manually entered
 * application data and returns a list of findings sorted by severity.
 */
export function runApplicationChecks(data: ApplicationCheckInput): ApplicationCheckResult[] {
  const results: ApplicationCheckResult[] = []
  const personCount = Math.max(data.persons.length, 1)

  checkIncomeConsistency(data, personCount, results)
  checkSsnCoverage(data, personCount, results)
  checkImmigrationStatus(data, personCount, results)
  checkRequiredSupplements(data, personCount, results)
  checkAgeThresholds(data, personCount, results)

  // Sort: errors first, then warnings, then info
  const order: Record<CheckSeverity, number> = { error: 0, warning: 1, info: 2 }
  results.sort((a, b) => order[a.severity] - order[b.severity])

  return results
}
