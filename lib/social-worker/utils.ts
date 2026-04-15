/**
 * Shared social worker utilities.
 * @author Bin Lee
 */

export function getSocialWorkerPatientDisplayName(patient: {
  first_name: string | null
  last_name: string | null
  email: string
}): string {
  return [patient.first_name, patient.last_name].filter(Boolean).join(" ") || patient.email
}

export function getAgeFromDateOfBirth(dob: string | null): string | null {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)))
}
