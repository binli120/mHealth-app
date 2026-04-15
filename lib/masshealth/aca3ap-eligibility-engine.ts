/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { FPL_TABLE_2026, FPL_INCREMENT_AFTER_4 } from "./constants"
import type {
  CitizenshipStatus,
  EligibilityIncomeInput,
  EligibilityFindingLevel,
  EligibilityFinding,
  EligibilityRuleStatus,
  EligibilityRuleResult,
  Aca3ApEligibilityApplicantInput,
  Aca3ApEligibilityResult,
} from "./types"

export type {
  CitizenshipStatus,
  EligibilityIncomeInput,
  EligibilityFindingLevel,
  EligibilityFinding,
  EligibilityRuleStatus,
  EligibilityRuleResult,
  Aca3ApEligibilityApplicantInput,
  Aca3ApEligibilityResult,
}

function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

function resolveFplForHouseholdSize(householdSize: number): number {
  if (householdSize <= 1) return FPL_TABLE_2026[1]
  if (FPL_TABLE_2026[householdSize]) return FPL_TABLE_2026[householdSize]
  const additionalPeople = householdSize - 4
  return FPL_TABLE_2026[4] + additionalPeople * FPL_INCREMENT_AFTER_4
}

function computeNewHouseholdSize(input: Aca3ApEligibilityApplicantInput): number {
  // Existing household + the additional person being added
  let size = clampNonNegativeInteger(input.existingHouseholdSize) + 1
  // Count unborn children if applicant is pregnant
  if (input.pregnant) {
    size += clampNonNegativeInteger(input.unbornChildren)
  }
  return Math.max(1, size)
}

function computeMagiIncome(income: EligibilityIncomeInput): number {
  const total =
    (income.wages ?? 0) +
    (income.selfEmployment ?? 0) +
    (income.unemployment ?? 0) +
    (income.socialSecurityTaxable ?? 0) +
    (income.rentalIncome ?? 0) +
    (income.interest ?? 0) +
    (income.pension ?? 0)
  return Math.max(0, Math.round(total))
}

function addRequiredDocument(requiredDocuments: string[], document: string): void {
  if (!requiredDocuments.includes(document)) {
    requiredDocuments.push(document)
  }
}

/**
 * Evaluates whether an additional person qualifies to be added to an existing
 * ACA-3 household case. Returns findings, rule results, the suggested program,
 * and required documents.
 */
export function evaluateAca3ApEligibility(
  input: Aca3ApEligibilityApplicantInput,
): Aca3ApEligibilityResult {
  const findings: EligibilityFinding[] = []
  const ruleResults: EligibilityRuleResult[] = []
  const requiredDocuments: string[] = []
  let status: Aca3ApEligibilityResult["status"] = "APPROVED"
  let eligibleProgram = "MassHealth CarePlus"

  // ── RULE 01: Massachusetts Residency ─────────────────────────────────────────
  if (!input.maResident) {
    status = "DENIED"
    eligibleProgram = "Ineligible"
    findings.push({
      code: "RESIDENCY_DENIED",
      level: "error",
      message: "Additional person is not a Massachusetts resident.",
    })
    addRequiredDocument(requiredDocuments, "MA ID / Driver License")
    addRequiredDocument(requiredDocuments, "Lease / Utility Bill / Government Mail")
  }
  ruleResults.push({
    id: "RULE_01_RESIDENCY",
    label: "Massachusetts Residency",
    status: input.maResident ? "pass" : "fail",
    message: input.maResident
      ? "Residency requirement met."
      : "Additional person is not a Massachusetts resident.",
  })

  // ── RULE 02: Existing Case Linkage ────────────────────────────────────────────
  if (!input.addingToExistingCase) {
    if (status !== "DENIED") status = "PENDING_VERIFICATION"
    findings.push({
      code: "NO_EXISTING_CASE",
      level: "warning",
      message: "ACA-3-AP requires an existing MassHealth case. Use ACA-3 for a new application.",
    })
  }
  ruleResults.push({
    id: "RULE_02_EXISTING_CASE",
    label: "Existing Case Linkage",
    status: input.addingToExistingCase ? "pass" : "fail",
    message: input.addingToExistingCase
      ? "Existing case confirmed."
      : "No existing case — applicant should use ACA-3 instead.",
  })

  // ── RULE 03: Identity Verification ────────────────────────────────────────────
  if (!input.identityVerified && status !== "DENIED") {
    status = "PENDING_VERIFICATION"
    findings.push({
      code: "IDENTITY_PENDING",
      level: "warning",
      message: "Identity documentation is required before eligibility can be finalized.",
    })
    addRequiredDocument(requiredDocuments, "SSN verification")
    addRequiredDocument(requiredDocuments, "Passport or Birth Certificate")
  }
  ruleResults.push({
    id: "RULE_03_IDENTITY",
    label: "Identity Verification",
    status: input.identityVerified ? "pass" : "fail",
    message: input.identityVerified
      ? "Identity verification is complete."
      : "Identity documentation is required.",
  })

  // ── RULE 04: Citizenship / Immigration ────────────────────────────────────────
  const isQualifiedCitizenship =
    input.citizenshipStatus === "US_CITIZEN" ||
    input.citizenshipStatus === "NATIONAL" ||
    input.citizenshipStatus === "QUALIFIED_NONCITIZEN" ||
    input.citizenshipStatus === "LEGAL_PERMANENT_RESIDENT" ||
    input.citizenshipStatus === "REFUGEE" ||
    input.citizenshipStatus === "ASYLEE" ||
    input.citizenshipStatus === "TPS"

  if (!isQualifiedCitizenship && status !== "DENIED") {
    status = "LIMITED_COVERAGE"
    eligibleProgram = "MassHealth Limited"
    findings.push({
      code: "LIMITED_COVERAGE",
      level: "warning",
      message: "Citizenship/immigration status indicates limited coverage only.",
    })
    addRequiredDocument(requiredDocuments, "Immigration document (I-551, EAD, I-94, etc.)")
  }
  ruleResults.push({
    id: "RULE_04_CITIZENSHIP",
    label: "Citizenship / Immigration",
    status: isQualifiedCitizenship ? "pass" : "warning",
    message: isQualifiedCitizenship
      ? "Citizenship/immigration status allows full program evaluation."
      : "Limited coverage applies based on immigration status.",
  })

  // ── RULE 05: Household Size (after adding person) ─────────────────────────────
  const newHouseholdSize = computeNewHouseholdSize(input)
  ruleResults.push({
    id: "RULE_05_HOUSEHOLD_SIZE",
    label: "New Household Size",
    status: "pass",
    message: `Household size after adding person: ${newHouseholdSize}.`,
  })

  // ── RULE 06: MAGI Income ──────────────────────────────────────────────────────
  const totalIncome = computeMagiIncome(input.income)
  ruleResults.push({
    id: "RULE_06_MAGI_INCOME",
    label: "MAGI Income Calculation",
    status: "pass",
    message: `Computed annual MAGI income: $${totalIncome.toLocaleString()}.`,
  })

  // ── RULE 07: FPL Percentage ───────────────────────────────────────────────────
  const fplAmount = resolveFplForHouseholdSize(newHouseholdSize)
  const fplPercent = fplAmount > 0 ? Math.round((totalIncome / fplAmount) * 100) : 0
  ruleResults.push({
    id: "RULE_07_FPL_PERCENT",
    label: "Federal Poverty Level",
    status: "pass",
    message: `FPL percent: ${fplPercent}% for new household size ${newHouseholdSize}.`,
  })

  // ── RULE 08: Age — 65+ must use SACA-2 ───────────────────────────────────────
  if (input.age >= 65 && status !== "DENIED") {
    status = "REDIRECT_SACA2"
    eligibleProgram = "Redirect to SACA-2"
    findings.push({
      code: "AGE_REDIRECT_SACA2",
      level: "warning",
      message: "Additional person is age 65 or older. SACA-2 application is required.",
    })
  }
  ruleResults.push({
    id: "RULE_08_AGE",
    label: "Age Rule",
    status: input.age < 65 ? "pass" : "fail",
    message: input.age < 65
      ? "Age is within ACA-3-AP range (<65)."
      : "Age 65+ must be redirected to SACA-2.",
  })

  // ── RULE 09: Program Determination ───────────────────────────────────────────
  if (status === "APPROVED" || status === "LIMITED_COVERAGE") {
    if (input.pregnant && fplPercent <= 200) {
      eligibleProgram = "MassHealth Standard"
    } else if (input.disabled) {
      eligibleProgram = "MassHealth CommonHealth"
    } else if (input.age < 19) {
      if (fplPercent <= 150) {
        eligibleProgram = "MassHealth Standard"
      } else if (fplPercent <= 300) {
        eligibleProgram = "MassHealth Family Assistance"
      } else {
        eligibleProgram = "Health Connector"
      }
    } else if (input.age >= 19 && input.age <= 64 && !input.pregnant && !input.disabled && fplPercent <= 138) {
      eligibleProgram = "MassHealth CarePlus"
    } else {
      eligibleProgram = "Health Connector"
    }
  }
  ruleResults.push({
    id: "RULE_09_PROGRAM",
    label: "Program Qualification",
    status: status === "DENIED" || status === "REDIRECT_SACA2" ? "fail" : "pass",
    message: `Program result: ${eligibleProgram}.`,
  })

  // ── RULE 10: Other Insurance / TPL ───────────────────────────────────────────
  if (input.hasOtherInsurance && status !== "DENIED") {
    if (status === "APPROVED") status = "TPL_REQUIRED"
    findings.push({
      code: "TPL_REQUIRED",
      level: "warning",
      message: "Other insurance detected. Third Party Liability documentation is required.",
    })
    addRequiredDocument(requiredDocuments, "TPL form")
  }
  ruleResults.push({
    id: "RULE_10_OTHER_INSURANCE",
    label: "Other Insurance / TPL",
    status: input.hasOtherInsurance ? "warning" : "pass",
    message: input.hasOtherInsurance
      ? "Third Party Liability documentation is required."
      : "No other insurance reported.",
  })

  // ── RULE 11: Disability ───────────────────────────────────────────────────────
  if (input.disabled) {
    addRequiredDocument(requiredDocuments, "Disability Supplement form")
    if (!input.medicalVerification && status !== "DENIED") {
      if (status === "APPROVED") status = "PENDING_DOCUMENTS"
      findings.push({
        code: "DISABILITY_MEDICAL_VERIFICATION_REQUIRED",
        level: "warning",
        message: "Medical verification is required for disability-based eligibility.",
      })
      addRequiredDocument(requiredDocuments, "Medical verification")
    }
  }
  ruleResults.push({
    id: "RULE_11_DISABILITY",
    label: "Disability Rule",
    status: !input.disabled || input.medicalVerification ? "pass" : "warning",
    message: !input.disabled
      ? "No disability verification required."
      : input.medicalVerification
        ? "Disability verification is complete."
        : "Medical verification is required for disability eligibility.",
  })

  // ── RULE 12: Auto Verification Checks ─────────────────────────────────────────
  const verificationMismatch =
    !input.verification.ssnVerified ||
    !input.verification.incomeVerified ||
    !input.verification.immigrationVerified

  if (verificationMismatch && status !== "DENIED") {
    if (status === "APPROVED") status = "PENDING_DOCUMENTS"
    findings.push({
      code: "VERIFICATION_MISMATCH",
      level: "warning",
      message: "Auto-verification mismatch detected; supporting documents are required.",
    })
    addRequiredDocument(requiredDocuments, "Verification documents")
  }
  ruleResults.push({
    id: "RULE_12_VERIFICATION",
    label: "Auto Verification Checks",
    status: verificationMismatch ? "warning" : "pass",
    message: verificationMismatch
      ? "One or more verification checks require supporting documents."
      : "SSN, income, and immigration checks passed.",
  })

  // ── Final decision ────────────────────────────────────────────────────────────
  if (findings.length === 0) {
    findings.push({
      code: "RULES_PASS",
      level: "success",
      message: "All rules passed. Additional person qualifies to be added to the household case.",
    })
  }
  ruleResults.push({
    id: "RULE_13_FINAL_DECISION",
    label: "Final Eligibility Decision",
    status:
      status === "DENIED" || status === "REDIRECT_SACA2"
        ? "fail"
        : status === "APPROVED"
          ? "pass"
          : "warning",
    message: `Final status: ${status}.`,
  })

  return {
    applicant_id: input.applicantId,
    new_household_size: newHouseholdSize,
    income: totalIncome,
    fpl_percent: fplPercent,
    eligible_program: eligibleProgram,
    status,
    required_documents: requiredDocuments,
    findings,
    rule_results: ruleResults,
  }
}
