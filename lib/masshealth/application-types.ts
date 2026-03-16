// Types are defined in types.ts; re-exported here for backward compatibility.
import type { MassHealthApplicationType, MassHealthApplicationTypeOption } from "./types"
export type { MassHealthApplicationType, MassHealthApplicationTypeOption }

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
  },
]

export function isMassHealthApplicationType(
  value: string,
): value is MassHealthApplicationType {
  return MASSHEALTH_APPLICATION_TYPES.some((type) => type.id === value)
}
