/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2Option } from "./types"

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function toOptions(labels: readonly string[]): Saca2Option[] {
  return labels.map((label) => ({ value: slugify(label), label }))
}

/** Eligible immigration statuses (form page 32). */
export const IMMIGRATION_STATUS_OPTIONS: Saca2Option[] = toOptions([
  "Amerasian",
  "Granted asylum",
  "Cuban Haitian entrant",
  "Deportation withheld",
  "Native American born in Canada or non-US territories",
  "Refugee",
  "Victim of severe trafficking or their spouse, child, sibling, or parent",
  "Iraqi special immigrant",
  "Afghan special immigrant or certain Afghan evacuees",
  "Conditional entrant granted before 1980",
  "Veteran or active-duty military or their spouse or dependent",
  "COFA Migrant",
  "Lawful permanent resident",
  "Granted parole for at least one year",
  "Battered spouse or child (or their parent or child)",
  "Nonimmigrant status (visa)",
  "Granted parole for less than one year",
  "Granted temporary resident status",
  "Granted Temporary Protected Status (TPS) or applicant for TPS with employment authorization",
  "Granted employment authorization under 8 CFR 274a(12)(c)",
  "Family unity beneficiaries",
  "Deferred enforced departure",
  "Deferred Action Status except for Deferred Action for Childhood Arrivals (DACA)",
  "Granted an administrative stay of removal under 8 CFR 241",
  "Approved visa petition with a pending application for adjustment of status",
  "Applicant for asylum or for withholding of removal with employment authorization",
  "Applicant (for at least 180 days) under 14 years old for asylum or for withholding of removal",
  "Granted withholding of removal under the Convention Against Torture",
  "Applicant for Special Immigrant Juvenile (SIJ) status",
  "Applicant or granted status under Deferred Action for Childhood Arrivals (DACA)",
  "I have a document but do not have any status listed above (Person Residing Under Color of Law, PRUCOL)",
])

/** Immigration document types (form page 32). */
export const IMMIGRATION_DOCUMENT_OPTIONS: Saca2Option[] = toOptions([
  "Reentry Permit (I-327)",
  "Permanent Resident Card (green card, I-551)",
  "Refugee Travel Document (I-571)",
  "Employment Authorization Card (I-766)",
  "Machine Readable Immigrant Visa (with temporary I-551 language)",
  "Temporary I-551 stamp (on passport or I-94, I-94A)",
  "Arrival/Departure Record (I-94, I-94A)",
  "Arrival/Departure Record in unexpired foreign passport (I-94)",
  "Foreign passport",
  "Certificate of Eligibility for Nonimmigrant Student Status (I-20)",
  "Certificate of Eligibility for Exchange Visitor Status (DS2019)",
  "Notice of Action (I-797)",
  "Document indicating withholding of removal (or withholding of deportation)",
  "Administrative order staying removal issued by the Department of Homeland Security",
  "Document indicating a member of a federally recognized Indian tribe or American Indian born in Canada",
  "Office of Refugee Resettlement (ORR) eligibility letter (if under 18)",
  "Resident of American Samoa Card",
  "USCIS Acknowledgement of Receipt (I-797C)",
  "US Visas (such as B1/B2, R-Visa, Border Crossing Card, J/F/M)",
])
