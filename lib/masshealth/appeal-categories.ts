/**
 * Built-in MassHealth appeal categories used when the analysis service is
 * unavailable. Keep these broad and deterministic; detailed legal grounding is
 * still retrieved during the research step.
 *
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

export interface AppealCategoryEntry {
  code: string
  label: string
  description: string
  notice_keywords: string[]
  evidence_needed: string[]
  argument_themes: string[]
  missing_info_questions: string[]
}

export const FALLBACK_APPEAL_CATEGORIES: AppealCategoryEntry[] = [
  {
    code: "income_exceeds_limit",
    label: "Income exceeds eligibility limit",
    description: "MassHealth says household income is above the program limit.",
    notice_keywords: ["income", "wages", "over income", "too high", "fpl"],
    evidence_needed: ["Recent pay stubs", "Tax return", "Employer letter", "Proof of changed income"],
    argument_themes: ["Income was calculated incorrectly", "Current income is lower than reported"],
    missing_info_questions: ["What income amount did the notice use?", "Has income changed since the notice?"],
  },
  {
    code: "missing_documentation",
    label: "Missing required documentation",
    description: "MassHealth says proof or verification was missing or incomplete.",
    notice_keywords: ["missing", "proof", "verification", "documents", "incomplete"],
    evidence_needed: ["The requested document", "Submission confirmation", "Case notice", "Follow-up correspondence"],
    argument_themes: ["Documents were already submitted", "Documents are now available"],
    missing_info_questions: ["Which document did MassHealth request?", "When was it submitted?"],
  },
  {
    code: "residency_not_verified",
    label: "Massachusetts residency not verified",
    description: "MassHealth says Massachusetts residency was not confirmed.",
    notice_keywords: ["resident", "residency", "address", "Massachusetts", "MA"],
    evidence_needed: ["Lease or mortgage statement", "Utility bill", "School or employer record", "Mail showing MA address"],
    argument_themes: ["Applicant lives in Massachusetts", "Address records were incomplete or outdated"],
    missing_info_questions: ["What is the current Massachusetts address?", "What proof of address is available?"],
  },
  {
    code: "citizenship_immigration",
    label: "Citizenship or immigration status issue",
    description: "MassHealth says citizenship, national, or immigration status was not verified.",
    notice_keywords: ["citizenship", "immigration", "qualified", "status", "lawful"],
    evidence_needed: ["Passport", "Birth certificate", "Naturalization certificate", "Immigration document"],
    argument_themes: ["Status was verified or can be verified", "The notice used incomplete status information"],
    missing_info_questions: ["What status did the applicant report?", "What immigration or citizenship document is available?"],
  },
  {
    code: "ssn_not_verified",
    label: "Social Security Number not verified",
    description: "MassHealth says the SSN could not be verified or was missing.",
    notice_keywords: ["social security", "ssn", "number", "ssa", "verification"],
    evidence_needed: ["Social Security card", "SSA letter", "Tax document showing SSN", "Corrected application information"],
    argument_themes: ["The SSN was entered incorrectly", "The applicant can provide proof of SSN"],
    missing_info_questions: ["Was the SSN entered correctly?", "Is there proof showing the SSN?"],
  },
  {
    code: "missing_disability_proof",
    label: "Disability proof or disability status issue",
    description: "MassHealth says disability status was not supported by enough evidence.",
    notice_keywords: ["disability", "disabled", "medical proof", "commonhealth", "ssa disability"],
    evidence_needed: ["SSA disability award", "Medical provider letter", "Functional limitation records", "Treatment records"],
    argument_themes: ["Disability evidence supports eligibility", "Additional medical evidence is available"],
    missing_info_questions: ["What disability proof was submitted?", "Is there an SSA or provider document?"],
  },
  {
    code: "age_not_eligible",
    label: "Age not eligible for program category",
    description: "MassHealth says age affects the requested coverage category.",
    notice_keywords: ["age", "too old", "too young", "category", "program"],
    evidence_needed: ["Date of birth proof", "Notice showing the program category", "Household member information"],
    argument_themes: ["The age or program category was applied incorrectly", "A different MassHealth category may apply"],
    missing_info_questions: ["What age or date of birth did the notice use?", "Which program category was denied?"],
  },
  {
    code: "already_enrolled",
    label: "Other health coverage or enrollment issue",
    description: "MassHealth says other coverage or existing enrollment affects eligibility.",
    notice_keywords: ["other insurance", "coverage", "employer", "enrolled", "medicare"],
    evidence_needed: ["Insurance termination letter", "Employer coverage details", "Medicare card", "Premium or coverage notice"],
    argument_themes: ["Other coverage ended or is not available", "Coverage details were misunderstood"],
    missing_info_questions: ["What other coverage did the notice list?", "Is that coverage still active?"],
  },
  {
    code: "other",
    label: "Other denial or reduction reason",
    description: "Use this when the notice reason does not fit another category.",
    notice_keywords: ["denied", "reduced", "closed", "terminated", "not eligible"],
    evidence_needed: ["Full notice", "Application records", "Relevant proof documents", "Timeline of contacts"],
    argument_themes: ["The notice reason needs review", "Facts or documents may have been missed"],
    missing_info_questions: ["What exact reason does the notice give?", "What outcome is the applicant requesting?"],
  },
]
