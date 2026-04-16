/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

/**
 * Shared form dropdown option lists used across benefit-orchestration wizard,
 * ACA-3 form, pre-screener, and any future feature that needs these selects.
 */

import type {
  CitizenshipStatus,
  EmploymentStatus,
  HousingStatus,
  TaxFilingStatus,
  UtilityType,
  RelationshipType,
} from "@/lib/benefit-orchestration/types"
import type { SelectOption } from "@/lib/types/common"

export const CITIZENSHIP_OPTIONS: SelectOption<CitizenshipStatus>[] = [
  { value: "citizen", label: "US Citizen or US National" },
  { value: "qualified_immigrant", label: "Qualified Immigrant (LPR, refugee, asylee, etc.)" },
  { value: "other", label: "Other immigration status" },
  { value: "undocumented", label: "Undocumented / No immigration status" },
]

export const EMPLOYMENT_OPTIONS: SelectOption<EmploymentStatus>[] = [
  { value: "employed", label: "Employed (W-2)" },
  { value: "self_employed", label: "Self-employed / Freelance" },
  { value: "unemployed", label: "Unemployed / Looking for work" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Retired" },
  { value: "not_working", label: "Not currently working" },
]

export const HOUSING_OPTIONS: SelectOption<HousingStatus>[] = [
  { value: "renter", label: "Renter" },
  { value: "owner", label: "Homeowner" },
  { value: "living_with_family", label: "Living with family / others (no rent)" },
  { value: "homeless", label: "Experiencing homelessness" },
  { value: "shelter", label: "In a shelter or transitional housing" },
  { value: "other", label: "Other" },
]

export const FILING_STATUS_OPTIONS: SelectOption<TaxFilingStatus>[] = [
  { value: "single", label: "Single" },
  { value: "head_of_household", label: "Head of Household" },
  { value: "married_filing_jointly", label: "Married Filing Jointly" },
  { value: "married_filing_separately", label: "Married Filing Separately" },
  { value: "qualifying_widow", label: "Qualifying Surviving Spouse" },
]

export const RELATIONSHIP_OPTIONS: SelectOption<RelationshipType>[] = [
  { value: "spouse", label: "Spouse" },
  { value: "partner", label: "Domestic partner" },
  { value: "child", label: "Child" },
  { value: "stepchild", label: "Stepchild" },
  { value: "grandchild", label: "Grandchild" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "grandparent", label: "Grandparent" },
  { value: "other_relative", label: "Other relative" },
  { value: "non_relative", label: "Non-relative" },
]

export const UTILITY_OPTIONS: SelectOption<UtilityType>[] = [
  { value: "heat", label: "Heating (oil, gas, wood)" },
  { value: "electricity", label: "Electricity" },
  { value: "gas", label: "Natural gas" },
  { value: "other", label: "Other utility" },
]
