import acaSchemaData from "@/config/ACA-03-0325.json"
import type { AcaSchema, SchemaSection } from "@/components/application/aca3/types"

type Aca3PersonSectionKey = "identity" | "demographics" | "ssn" | "tax" | "coverage" | "income"

export const ACA3_SCHEMA = acaSchemaData as AcaSchema
export const ACA3_PERSON_SECTIONS_BY_ID: ReadonlyMap<string, SchemaSection> = new Map(
  ACA3_SCHEMA.person_schema.sub_sections
    .filter((section) => Boolean(section.sub_section_id))
    .map((section) => [section.sub_section_id as string, section]),
)

export const FORM_CACHE_KEY_PREFIX = "mhealth:aca-03-0325:wizard:v1"
export const DOB_FIELD_PATTERN = /(^|_)dob$/i
export const DATE_PATTERN = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const SSN_PATTERN = /^\d{3}-\d{2}-\d{4}$/
export const MAX_DOB_AGE_YEARS = 120
export const ACA_PDF_VIEW_ENDPOINT = "/api/forms/aca-3-0325/fill"

export const STEP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export const SUPPORTED_LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "Portuguese (Brazil)",
  "Haitian Creole",
  "Simplified Chinese",
  "Vietnamese",
] as const

export const SUPPORTED_LANGUAGE_FIELD_IDS = new Set(["p1_language_spoken", "p1_language_written"])

export const US_STATE_CODES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
] as const

export const MAX_PERSON_COUNT = 8
export const HOUSEHOLD_SIZE_FIELD_ID = "p1_num_people"
export const HOUSEHOLD_SIZE_OPTIONS = Array.from({ length: MAX_PERSON_COUNT }, (_, index) => String(index + 1))
export const FULL_NAME_FIELD_IDS = new Set(["p1_name", "assister_name", "ssn_card_name", "tax_filer_name", "name"])

export const STEP_METADATA = [
  { id: "program-selection", title: "Program Selection", shortTitle: "Program" },
  { id: "primary-applicant", title: "Primary Applicant", shortTitle: "Applicant" },
  { id: "household-members", title: "Household Members", shortTitle: "Household" },
  { id: "demographics-ssn", title: "Demographics & SSN", shortTitle: "Demo/SSN" },
  { id: "tax-filing", title: "Tax Filing", shortTitle: "Tax" },
  { id: "coverage-eligibility", title: "Coverage & Eligibility", shortTitle: "Coverage" },
  { id: "income-deductions", title: "Income & Deductions", shortTitle: "Income" },
  { id: "review-pdf", title: "Review PDF", shortTitle: "Review" },
  { id: "validate-submit", title: "Validate & Submit", shortTitle: "Validate" },
] as const

export const PERSON_SECTION_MAP: Record<string, Aca3PersonSectionKey> = {
  ss_identity: "identity",
  ss_demographics: "demographics",
  ss_ssn: "ssn",
  ss_tax: "tax",
  ss_coverage: "coverage",
  ss_income: "income",
}

export const PERSON_STEP_SECTION_IDS: Record<number, string[]> = {
  3: ["ss_identity"],
  4: ["ss_demographics", "ss_ssn"],
  5: ["ss_tax"],
  6: ["ss_coverage"],
  7: ["ss_income"],
}
