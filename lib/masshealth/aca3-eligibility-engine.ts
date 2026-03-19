/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { FPL_TABLE_2026, FPL_INCREMENT_AFTER_4 } from "./constants"
import type {
  CitizenshipStatus,
  EligibilityIncomeInput,
  Aca3EligibilityApplicantInput,
  EligibilityFindingLevel,
  EligibilityFinding,
  EligibilityRuleStatus,
  EligibilityRuleResult,
  Aca3EligibilityResult,
} from "./types"

// Re-export so existing consumers (`form-wizard.tsx`, etc.) keep working unchanged.
export type {
  CitizenshipStatus,
  EligibilityIncomeInput,
  Aca3EligibilityApplicantInput,
  EligibilityFindingLevel,
  EligibilityFinding,
  EligibilityRuleStatus,
  EligibilityRuleResult,
  Aca3EligibilityResult,
}

function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  return Math.floor(value)
}

function resolveFplForHouseholdSize(householdSize: number): number {
  if (householdSize <= 1) {
    return FPL_TABLE_2026[1]
  }

  if (FPL_TABLE_2026[householdSize]) {
    return FPL_TABLE_2026[householdSize]
  }

  // Inference: values grow linearly by $5,380 per additional person.
  const additionalPeople = householdSize - 4
  return FPL_TABLE_2026[4] + additionalPeople * FPL_INCREMENT_AFTER_4
}

function computeHouseholdSize(input: Aca3EligibilityApplicantInput): number {
  let householdSize = 1

  if (input.married) {
    householdSize += 1
  }

  if (input.taxFiler) {
    householdSize += clampNonNegativeInteger(input.taxDependents)
  } else {
    householdSize += clampNonNegativeInteger(input.taxDependents)
  }

  if (input.pregnant) {
    householdSize += clampNonNegativeInteger(input.unbornChildren)
  }

  return Math.max(1, householdSize)
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

export function evaluateAca3Eligibility(input: Aca3EligibilityApplicantInput): Aca3EligibilityResult {
  const findings: EligibilityFinding[] = []
  const ruleResults: EligibilityRuleResult[] = []
  const requiredDocuments: string[] = []
  let status: Aca3EligibilityResult["status"] = "APPROVED"
  let eligibleProgram = "MassHealth CarePlus"
  const isMassachusettsResident = input.stateResident.trim().toUpperCase() === "MA"

  if (!isMassachusettsResident) {
    status = "DENIED"
    eligibleProgram = "Ineligible"
    findings.push({
      code: "RESIDENCY_DENIED",
      level: "error",
      message: "Applicant is not a Massachusetts resident.",
    })
    addRequiredDocument(requiredDocuments, "MA ID / Driver License")
    addRequiredDocument(requiredDocuments, "Lease / Utility Bill / Government Mail")
  }
  ruleResults.push({
    id: "RULE_01_RESIDENCY",
    label: "Massachusetts Residency",
    status: isMassachusettsResident ? "pass" : "fail",
    message: isMassachusettsResident
      ? "Residency requirement met."
      : "Applicant is not a Massachusetts resident.",
  })

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
    id: "RULE_02_IDENTITY",
    label: "Identity Verification",
    status: input.identityVerified ? "pass" : "fail",
    message: input.identityVerified
      ? "Identity verification is complete."
      : "Identity documentation is required.",
  })

  const isQualifiedCitizenship =
    input.citizenshipStatus === "US_CITIZEN" ||
    input.citizenshipStatus === "NATIONAL" ||
    input.citizenshipStatus === "QUALIFIED_NONCITIZEN"

  if (!isQualifiedCitizenship && status !== "DENIED") {
    status = "LIMITED_COVERAGE"
    eligibleProgram = "MassHealth Limited"
    findings.push({
      code: "LIMITED_COVERAGE",
      level: "warning",
      message: "Citizenship/immigration status indicates limited coverage.",
    })
  }
  ruleResults.push({
    id: "RULE_03_CITIZENSHIP",
    label: "Citizenship / Immigration",
    status: isQualifiedCitizenship ? "pass" : "warning",
    message: isQualifiedCitizenship
      ? "Citizenship/immigration status allows full program evaluation."
      : "Limited coverage applies for current status.",
  })

  const householdSize = computeHouseholdSize(input)
  ruleResults.push({
    id: "RULE_04_HOUSEHOLD_SIZE",
    label: "Household Size",
    status: "pass",
    message: `Computed household size: ${householdSize}.`,
  })

  const totalIncome = computeMagiIncome(input.income)
  ruleResults.push({
    id: "RULE_05_MAGI_INCOME",
    label: "MAGI Income Calculation",
    status: "pass",
    message: `Computed annual MAGI income: $${totalIncome.toLocaleString()}.`,
  })

  const fplAmount = resolveFplForHouseholdSize(householdSize)
  const fplPercent = fplAmount > 0 ? Math.round((totalIncome / fplAmount) * 100) : 0
  ruleResults.push({
    id: "RULE_06_FPL_PERCENT",
    label: "Federal Poverty Level",
    status: "pass",
    message: `FPL percent: ${fplPercent}% for household size ${householdSize}.`,
  })

  ruleResults.push({
    id: "RULE_07_TAX_FILING",
    label: "Tax Filing Household Rule",
    status: input.taxFiler ? "pass" : "warning",
    message: input.taxFiler
      ? "Tax filer rules applied."
      : "Non-filer pathway should be reviewed.",
  })

  ruleResults.push({
    id: "RULE_08_PREGNANCY",
    label: "Pregnancy Household Adjustment",
    status: "pass",
    message: input.pregnant
      ? `Pregnancy adjustment applied with ${clampNonNegativeInteger(input.unbornChildren)} unborn child(ren).`
      : "No pregnancy adjustment needed.",
  })

  if (input.age >= 65 && status !== "DENIED") {
    status = "REDIRECT_ACA2"
    eligibleProgram = "Redirect to ACA-2"
    findings.push({
      code: "AGE_REDIRECT",
      level: "warning",
      message: "Applicant age is 65 or older. ACA-2 application is required.",
    })
  }
  ruleResults.push({
    id: "RULE_09_AGE",
    label: "Age Rule",
    status: input.age < 65 ? "pass" : "fail",
    message: input.age < 65 ? "Age is within ACA-3 range (<65)." : "Age 65+ must be redirected to ACA-2.",
  })

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
    } else if (
      input.age >= 19 &&
      input.age <= 64 &&
      !input.pregnant &&
      !input.disabled &&
      fplPercent <= 138
    ) {
      eligibleProgram = "MassHealth CarePlus"
    } else {
      eligibleProgram = "Health Connector"
    }
  }
  ruleResults.push({
    id: "RULE_10_PROGRAM",
    label: "Program Qualification",
    status: status === "DENIED" || status === "REDIRECT_ACA2" ? "fail" : "pass",
    message: `Program result: ${eligibleProgram}.`,
  })

  if (input.hasOtherInsurance && status !== "DENIED") {
    if (status === "APPROVED") {
      status = "TPL_REQUIRED"
    }
    findings.push({
      code: "TPL_REQUIRED",
      level: "warning",
      message: "Other insurance detected. Third Party Liability documentation is required.",
    })
    addRequiredDocument(requiredDocuments, "TPL form")
  }
  ruleResults.push({
    id: "RULE_11_OTHER_INSURANCE",
    label: "Other Insurance / TPL",
    status: input.hasOtherInsurance ? "warning" : "pass",
    message: input.hasOtherInsurance
      ? "Third Party Liability documentation is required."
      : "No other insurance reported.",
  })

  if (input.disabled) {
    addRequiredDocument(requiredDocuments, "Disability Supplement form")

    if (!input.medicalVerification && status !== "DENIED") {
      if (status === "APPROVED") {
        status = "PENDING_DOCUMENTS"
      }
      findings.push({
        code: "DISABILITY_MEDICAL_VERIFICATION_REQUIRED",
        level: "warning",
        message: "Medical verification is required for disability-based eligibility.",
      })
      addRequiredDocument(requiredDocuments, "Medical verification")
    }
  }
  ruleResults.push({
    id: "RULE_12_DISABILITY",
    label: "Disability Rule",
    status: !input.disabled || input.medicalVerification ? "pass" : "warning",
    message: !input.disabled
      ? "No disability verification required."
      : input.medicalVerification
        ? "Disability verification is complete."
        : "Medical verification is required for disability eligibility.",
  })

  const verificationMismatch =
    !input.verification.ssnVerified ||
    !input.verification.incomeVerified ||
    !input.verification.immigrationVerified

  if (verificationMismatch && status !== "DENIED") {
    if (status === "APPROVED") {
      status = "PENDING_DOCUMENTS"
    }
    findings.push({
      code: "VERIFICATION_MISMATCH",
      level: "warning",
      message: "Auto-verification mismatch detected; supporting documents are required.",
    })
    addRequiredDocument(requiredDocuments, "Verification documents")
  }
  ruleResults.push({
    id: "RULE_13_VERIFICATION",
    label: "Auto Verification Checks",
    status: verificationMismatch ? "warning" : "pass",
    message: verificationMismatch
      ? "One or more verification checks require supporting documents."
      : "SSN, income, and immigration checks passed.",
  })

  if (findings.length === 0) {
    findings.push({
      code: "RULES_PASS",
      level: "success",
      message: "All rules passed for program determination.",
    })
  }
  ruleResults.push({
    id: "RULE_14_FINAL_DECISION",
    label: "Final Eligibility Decision",
    status: status === "DENIED" || status === "REDIRECT_ACA2" ? "fail" : status === "APPROVED" ? "pass" : "warning",
    message: `Final status: ${status}.`,
  })

  return {
    applicant_id: input.applicantId,
    household_size: householdSize,
    income: totalIncome,
    fpl_percent: fplPercent,
    eligible_program: eligibleProgram,
    status,
    required_documents: requiredDocuments,
    findings,
    rule_results: ruleResults,
  }
}
