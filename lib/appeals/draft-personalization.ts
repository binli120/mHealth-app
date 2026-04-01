import type { UserProfile } from "@/lib/user-profile/types"

export interface AppealDraftPrefill {
  applicantName: string
  contactInformation: string
  householdSummary: string
}

export interface AppealDraftPlaceholderValues {
  applicantName?: string | null
  contactInformation?: string | null
}

const PLACEHOLDER_PATTERNS: Array<{ pattern: RegExp; key: keyof AppealDraftPlaceholderValues }> = [
  { pattern: /\[(?:YOUR NAME|Your Name)\]/g, key: "applicantName" },
  { pattern: /\[(?:YOUR CONTACT INFORMATION|Your Contact Information)\]/g, key: "contactInformation" },
]

function normalizeLine(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildDisplayName(firstName?: string | null, lastName?: string | null): string | null {
  const parts = [normalizeLine(firstName), normalizeLine(lastName)].filter(Boolean)
  return parts.length > 0 ? parts.join(" ") : null
}

function buildCityStateZip(profile: UserProfile | null | undefined): string | null {
  if (!profile) return null

  const city = normalizeLine(profile.city)
  const state = normalizeLine(profile.state)
  const zip = normalizeLine(profile.zip)

  const locality = [city, state].filter(Boolean).join(", ")
  if (locality && zip) return `${locality} ${zip}`
  return locality || zip || null
}

export function buildAppealDraftPrefill(params: {
  profile?: UserProfile | null
  email?: string | null
  sessionFirstName?: string | null
  sessionLastName?: string | null
}): AppealDraftPrefill {
  const { profile, email, sessionFirstName, sessionLastName } = params
  const preferredName = normalizeLine(profile?.profileData.preferredName)
  const profileName = buildDisplayName(profile?.firstName, profile?.lastName)
  const sessionName = buildDisplayName(sessionFirstName, sessionLastName)
  const applicantName = preferredName || profileName || sessionName || ""

  const addressLine1 = normalizeLine(profile?.addressLine1)
  const addressLine2 = normalizeLine(profile?.addressLine2)
  const cityStateZip = buildCityStateZip(profile)
  const phone = normalizeLine(profile?.phone)
  const normalizedEmail = normalizeLine(email)

  const contactLines = [addressLine1, addressLine2, cityStateZip, phone, normalizedEmail].filter(Boolean)
  const contactInformation = contactLines.join("\n")

  const householdSize = profile?.familyProfileSummary?.householdSize
  const householdSummary = typeof householdSize === "number" && Number.isFinite(householdSize) && householdSize > 0
    ? `Household size: ${householdSize}`
    : ""

  return {
    applicantName,
    contactInformation,
    householdSummary,
  }
}

export function fillAppealDraftPlaceholders(
  letterText: string,
  values: AppealDraftPlaceholderValues,
): string {
  let next = letterText

  for (const { pattern, key } of PLACEHOLDER_PATTERNS) {
    const replacement = normalizeLine(values[key])
    if (!replacement) continue
    next = next.replace(pattern, replacement)
  }

  return next
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
}

export function buildAppealDraftWordHtml(letterText: string): string {
  const paragraphs = letterText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("")

  return [
    "<html>",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<style>",
    "body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; line-height: 1.5; margin: 1in; color: #111827; }",
    "p { margin: 0 0 12pt 0; }",
    "</style>",
    "</head>",
    "<body>",
    paragraphs,
    "</body>",
    "</html>",
  ].join("")
}

export function buildAppealDraftFilename(applicantName?: string | null): string {
  const normalized = (applicantName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized ? `masshealth-appeal-letter-${normalized}` : "masshealth-appeal-letter"
}
