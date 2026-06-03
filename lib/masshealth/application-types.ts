/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

// Types are defined in types.ts; re-exported here for backward compatibility.
import type { MassHealthApplicationType, MassHealthApplicationTypeOption } from "./types"
export type { MassHealthApplicationType, MassHealthApplicationTypeOption }

export interface ApplicationTypeQuickCheckAnswers {
  ageGroup?: "under65" | "senior"
  hasMedicare?: "yes" | "no"
  needsLongTermCare?: "yes" | "no"
  addingPersonToExistingCase?: "yes" | "no"
}

export interface ApplicationTypeRecommendation {
  applicationType: MassHealthApplicationType
  reason: string
}

export const MASSHEALTH_APPLICATION_TYPES: MassHealthApplicationTypeOption[] = [
  {
    id: "aca3",
    title:
      "Massachusetts Application for Health and Dental Coverage and Help Paying Costs",
    shortLabel: "ACA-3",
    description: "Standard application for most individuals and families.",
    formCode: "ACA-3 (03/26)",
    referenceUrl:
      "https://www.mass.gov/lists/applications-to-become-a-masshealth-member",
    baseFormType: "aca3",
  },
  {
    id: "hsn",
    title: "Health Safety Net Application",
    shortLabel: "HSN",
    description:
      "Apply online for a Health Safety Net Low Income Patient determination through the ACA-3 health coverage application.",
    formCode: "ACA-3 HSN Variant",
    referenceUrl:
      "https://www.mass.gov/how-to/apply-for-masshealth-the-health-safety-net-or-the-childrens-medical-security-plan",
    baseFormType: "aca3",
  },
  {
    id: "aca3ap",
    title:
      "Massachusetts Application for Health and Dental Coverage and Help Paying Costs - Additional Persons",
    shortLabel: "ACA-3-AP",
    description:
      "Use when adding people to an existing ACA-3 based household case.",
    formCode: "ACA-3-AP (03/25)",
    referenceUrl:
      "https://www.mass.gov/doc/massachusetts-application-for-health-and-dental-coverage-and-help-paying-costs-additional-persons/download",
    baseFormType: "aca3ap",
  },
  {
    id: "saca2",
    title:
      "Application for Health Coverage for Seniors and People Needing Long-Term-Care Services",
    shortLabel: "SACA-2",
    description:
      "For seniors and applicants seeking long-term-care related coverage.",
    formCode: "SACA-2 (03/26)",
    referenceUrl:
      "https://www.mass.gov/lists/applications-to-become-a-masshealth-member",
    baseFormType: "saca2",
  },
  {
    id: "msp",
    title: "Medicare Savings Programs Application",
    shortLabel: "MSP",
    description:
      "For help paying Medicare costs (premiums and other Medicare expenses).",
    formCode: "MSP Application",
    referenceUrl:
      "https://www.mass.gov/lists/applications-to-become-a-masshealth-member",
    baseFormType: "msp",
  },
]

export function isMassHealthApplicationType(
  value: string,
): value is MassHealthApplicationType {
  return MASSHEALTH_APPLICATION_TYPES.some((type) => type.id === value)
}

/**
 * Lookup map from application type id → short display label.
 * Derived from MASSHEALTH_APPLICATION_TYPES; single source of truth.
 * e.g. "aca3" → "ACA-3"
 */
export const APPLICATION_TYPE_LABELS = new Map<string, string>(
  MASSHEALTH_APPLICATION_TYPES.map((item) => [item.id, item.shortLabel]),
)

/**
 * Resolve a human-readable label for an application type id.
 *
 * - Known id  → short label (e.g. "ACA-3")
 * - Unknown id → uppercased id (e.g. "CUSTOM-FORM")
 * - null/empty → fallback string (defaults to "Application")
 */
export function getApplicationTypeLabel(
  type: string | null | undefined,
  fallback = "Application",
): string {
  if (!type) return fallback
  return APPLICATION_TYPE_LABELS.get(type) ?? type.toUpperCase()
}

export function getApplicationTypeBaseForm(
  type: MassHealthApplicationType,
): NonNullable<MassHealthApplicationTypeOption["baseFormType"]> {
  const option = MASSHEALTH_APPLICATION_TYPES.find((item) => item.id === type)
  if (option?.baseFormType) return option.baseFormType
  if (type === "hsn") return "aca3"
  return type
}

export function getApplicationTypeQuickCheckRecommendation(
  answers: ApplicationTypeQuickCheckAnswers,
): ApplicationTypeRecommendation | null {
  if (answers.addingPersonToExistingCase === "yes") {
    return {
      applicationType: "aca3ap",
      reason: "You are adding another person to an existing ACA-3 household case.",
    }
  }

  if (answers.needsLongTermCare === "yes" || answers.ageGroup === "senior") {
    return {
      applicationType: "saca2",
      reason: answers.needsLongTermCare === "yes"
        ? "You selected long-term-care coverage."
        : "You selected age 65 or older.",
    }
  }

  if (answers.hasMedicare === "yes") {
    return {
      applicationType: "msp",
      reason: "You selected Medicare and may need help with Medicare costs.",
    }
  }

  if (
    answers.ageGroup === "under65" &&
    answers.hasMedicare === "no" &&
    answers.needsLongTermCare === "no" &&
    answers.addingPersonToExistingCase === "no"
  ) {
    return {
      applicationType: "aca3",
      reason: "You selected the standard coverage path for most individuals and families.",
    }
  }

  return null
}
