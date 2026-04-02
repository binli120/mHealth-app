/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * Driver's license verification logic
 *
 * Compares extracted AAMVA barcode data against the applicant's profile
 * and returns a scored match result.
 *
 * Scoring weights (total = 100):
 *   Last name    : 30
 *   Date of birth: 30
 *   First name   : 20
 *   Address      : 20
 *
 * Thresholds:
 *   >= 70 → verified
 *   50–69 → needs_review  (staff queue)
 *   <  50 → failed
 */

import type { AamvaLicenseData } from "./aamva-parser"

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ApplicantProfile {
  firstName: string
  lastName: string
  /** Accepts YYYY-MM-DD or MM/DD/YYYY */
  dateOfBirth: string
  addressStreet: string
  addressCity: string
  addressState: string
  addressZip: string
}

export interface VerificationBreakdown {
  firstName: boolean
  lastName: boolean
  dateOfBirth: boolean
  address: boolean
}

export interface VerificationResult {
  /** 0–100 composite match score */
  score: number
  status: "verified" | "needs_review" | "failed"
  breakdown: VerificationBreakdown
  /** True when the license expiration date is in the past */
  isExpired: boolean
  /** Expiration date as YYYY-MM-DD (empty string if missing) */
  expirationDate: string
  /** Full name as read from the license */
  extractedName: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCORE_WEIGHTS: Record<keyof VerificationBreakdown, number> = {
  lastName: 30,
  dateOfBirth: 30,
  firstName: 20,
  address: 20,
}

const VERIFIED_THRESHOLD = 70
const REVIEW_THRESHOLD = 50

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compare AAMVA-decoded license data against a stored applicant profile.
 *
 * @param license  Parsed data from the PDF417 barcode.
 * @param profile  Applicant's stored profile fields.
 * @returns        Scored verification result.
 */
export function verifyLicenseAgainstProfile(
  license: AamvaLicenseData,
  profile: ApplicantProfile,
): VerificationResult {
  const isExpired = isLicenseExpired(license.expirationDate)

  const breakdown: VerificationBreakdown = {
    firstName: compareNames(license.firstName, profile.firstName),
    lastName: compareNames(license.lastName, profile.lastName),
    dateOfBirth: compareDates(license.dateOfBirth, profile.dateOfBirth),
    address: compareAddress(
      { street: license.addressStreet, zip: license.addressZip },
      { street: profile.addressStreet, zip: profile.addressZip },
    ),
  }

  const score = (Object.keys(breakdown) as Array<keyof VerificationBreakdown>).reduce(
    (total, key) => total + (breakdown[key] ? SCORE_WEIGHTS[key] : 0),
    0,
  )

  const status: VerificationResult["status"] =
    score >= VERIFIED_THRESHOLD
      ? "verified"
      : score >= REVIEW_THRESHOLD
        ? "needs_review"
        : "failed"

  return {
    score,
    status,
    breakdown,
    isExpired,
    expirationDate: license.expirationDate,
    extractedName: [license.firstName, license.lastName].filter(Boolean).join(" "),
  }
}

// ─── Name comparison ──────────────────────────────────────────────────────────

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z\s'-]/g, "")
    .replace(/\s+/g, " ")
}

function compareNames(a: string, b: string): boolean {
  if (!a || !b) return false
  return normalizeName(a) === normalizeName(b)
}

// ─── Date comparison ──────────────────────────────────────────────────────────

function normalizeDate(value: string): string {
  if (!value) return ""

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  // MM/DD/YYYY
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // MMDDYYYY (no separators, 8 digits)
  if (/^\d{8}$/.test(value)) {
    return `${value.substring(4)}-${value.substring(0, 2)}-${value.substring(2, 4)}`
  }

  return value
}

function compareDates(a: string, b: string): boolean {
  if (!a || !b) return false
  return normalizeDate(a) === normalizeDate(b)
}

// ─── Address comparison ───────────────────────────────────────────────────────

function extractStreetNumber(address: string): string {
  const match = /^(\d+)/.exec(address.trim())
  return match?.[1] ?? ""
}

function compareAddress(
  license: { street: string; zip: string },
  profile: { street: string; zip: string },
): boolean {
  const licenseZip = license.zip.trim().substring(0, 5)
  const profileZip = profile.zip.trim().substring(0, 5)
  const zipMatch = licenseZip.length === 5 && licenseZip === profileZip

  const licenseNum = extractStreetNumber(license.street)
  const profileNum = extractStreetNumber(profile.street)
  const streetNumMatch = Boolean(licenseNum && profileNum && licenseNum === profileNum)

  // Either ZIP or street number must match to award address points
  return zipMatch || streetNumMatch
}

// ─── Expiration check ─────────────────────────────────────────────────────────

function isLicenseExpired(expirationDate: string): boolean {
  if (!expirationDate) return false
  const expiry = new Date(expirationDate)
  return !isNaN(expiry.getTime()) && expiry < new Date()
}
