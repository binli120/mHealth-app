/**
 * @author Bin Lee
 * @email binlee120@gmail.com
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
 * Build a human-readable summary of what's been collected so far.
 * Sent to the API on each request so the LLM knows what to skip.
 */
export function summarizeCollectedFields(formData: Partial<ApplicationFormData>): string {
  const lines: string[] = []

  // Emit each personal field individually so partial pre-fills (e.g. firstName
  // from a profile but no lastName yet) are still visible to the LLM and it
  // doesn't re-ask for fields that are already collected.
  const personalParts = [
    formData.firstName ? `First name: ${formData.firstName}` : null,
    formData.lastName  ? `Last name: ${formData.lastName}`   : null,
    formData.dob       ? `DOB: ${formData.dob}`              : null,
  ].filter(Boolean)
  if (personalParts.length > 0) lines.push(`Personal: ${personalParts.join(", ")}`)

  const contactParts = [
    formData.email   ? `Email: ${formData.email}`   : null,
    formData.phone   ? `Phone: ${formData.phone}`   : null,
    formData.address
      ? `Address: ${[formData.address, formData.apartment, formData.city, formData.state, formData.zip].filter(Boolean).join(" ")}`
      : null,
  ].filter(Boolean)
  if (contactParts.length > 0) lines.push(`Contact: ${contactParts.join(" | ")}`)

  if (formData.citizenship) lines.push(`Citizenship: ${formData.citizenship}`)

  if (formData.householdMembers && formData.householdMembers.length > 0) {
    const memberSummary = formData.householdMembers
      .map((m) => {
        const parts = [`${m.firstName} ${m.lastName}`.trim()]
        if (m.relationship) parts.push(`relationship: ${m.relationship}`)
        if (m.dob) parts.push(`DOB: ${m.dob}`)
        return parts.join(", ")
      })
      .join(" | ")
    lines.push(`Household members (already confirmed — do NOT ask about these again): ${memberSummary}`)
  }

  if (formData.incomeSources && formData.incomeSources.length > 0) {
    const incomeSummary = formData.incomeSources
      .map((s) => `${s.type} $${s.amount}/${s.frequency}`)
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
