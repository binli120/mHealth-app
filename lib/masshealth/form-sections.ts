/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Client-safe utilities for form section tracking and progress computation.
 * No server-only imports — safe to use in Client Components.
 */
import type { ApplicationFormData } from "@/lib/redux/features/application-slice"

export type FormSection = "personal" | "contact" | "household" | "income" | "documents"

export const FORM_SECTION_ORDER: FormSection[] = [
  "personal",
  "contact",
  "household",
  "income",
  "documents",
]

/**
 * Build a field-presence summary for the LLM — indicates which fields are
 * filled without including actual values.  Actual values (name, DOB, address,
 * income amounts) are PHI and must never be sent to a third-party AI provider.
 */
export function summarizeCollectedFields(formData: Partial<ApplicationFormData>): string {
  const lines: string[] = []

  const personalParts = [
    formData.firstName ? "First name: [provided]" : null,
    formData.lastName  ? "Last name: [provided]"  : null,
    formData.dob       ? "DOB: [provided]"         : null,
  ].filter(Boolean)
  if (personalParts.length > 0) lines.push(`Personal: ${personalParts.join(", ")}`)

  const contactParts = [
    formData.email   ? "Email: [provided]"   : null,
    formData.phone   ? "Phone: [provided]"   : null,
    formData.address ? "Address: [provided]" : null,
  ].filter(Boolean)
  if (contactParts.length > 0) lines.push(`Contact: ${contactParts.join(" | ")}`)

  if (formData.citizenship) lines.push(`Citizenship: ${formData.citizenship}`)

  if (formData.householdMembers && formData.householdMembers.length > 0) {
    const memberSummary = formData.householdMembers
      .map((m) => {
        const parts = ["name: [provided]"]
        if (m.relationship) parts.push(`relationship: ${m.relationship}`)
        if (m.dob) parts.push("DOB: [provided]")
        return parts.join(", ")
      })
      .join(" | ")
    lines.push(`Household members (already confirmed — do NOT ask about these again): ${memberSummary}`)
  }

  if (formData.incomeSources && formData.incomeSources.length > 0) {
    const incomeSummary = formData.incomeSources
      .map((s) => `${s.type} [amount provided]/${s.frequency}`)
      .join(", ")
    lines.push(`Income: ${incomeSummary}`)
  }

  return lines.length > 0 ? lines.join("\n") : "Nothing collected yet."
}

/**
 * Determine which section the user is currently in based on collected data.
 */
export function detectCurrentSection(
  formData: Partial<ApplicationFormData>,
  noHouseholdMembers: boolean,
  noIncome: boolean,
): FormSection {
  const hasPersonal = Boolean(formData.firstName && formData.lastName && formData.dob)
  if (!hasPersonal) return "personal"

  const hasContact = Boolean(
    formData.email && formData.phone && formData.address && formData.city && formData.zip,
  )
  if (!hasContact) return "contact"

  const householdDone = noHouseholdMembers || (formData.householdMembers?.length ?? 0) > 0
  if (!householdDone) return "household"

  const incomeDone = noIncome || (formData.incomeSources?.length ?? 0) > 0
  if (!incomeDone) return "income"

  return "documents"
}
