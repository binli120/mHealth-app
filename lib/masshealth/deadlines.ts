export interface MassHealthDeadline {
  label: string
  /** ISO 8601 date string, e.g. "2026-12-31" */
  isoDate: string
}

/**
 * Known MassHealth enrollment and renewal deadlines.
 * Add entries here as new deadlines are announced.
 */
export const MASSHEALTH_DEADLINES: MassHealthDeadline[] = [
  { label: "Annual renewal window closes", isoDate: "2026-12-31" },
]

/**
 * Returns deadlines whose date is between now and `windowDays` days from now (inclusive).
 */
export function getUpcomingDeadlines(
  now: Date,
  windowDays = 30,
): MassHealthDeadline[] {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() + windowDays)
  return MASSHEALTH_DEADLINES.filter((d) => {
    const deadline = new Date(d.isoDate)
    return deadline >= now && deadline <= cutoff
  })
}
