/**
 * Regex-based extractor for ACA-3 MassHealth application form text.
 *
 * pdf-parse (v2) places all form template labels first, then the filled-in
 * values appear in a compact block right before the "-- 3 of 38 --" separator.
 *
 * Observed data block (page 3 of the PDF, page 1 of the form):
 *   Alex M Carter 07/14/1991
 *   123 Maple Street
 *   Boston 02118 Suffolk
 *   PO Box 9021             ← mailing address (skip)
 *   Boston 02118 Suffolk    ← mailing city/zip/county (skip — same as home)
 *   English
 *
 * The anchor sentence that immediately precedes the data block is:
 *   "This information helps us make sure everyone gets the coverage they may be eligible for."
 *
 * @author: Bin Lee
 */

import type { ApplicationFormData } from "@/lib/redux/features/application-slice"

/**
 * Find the short block of filled-in values that appears immediately before
 * the first page separator in the STEP 1 section.
 */
function extractDataBlock(text: string): string {
  // Primary anchor: the last STEP 1 instruction sentence before the data.
  const anchorMatch = text.match(
    /everyone gets the coverage they may be eligible for\.\n([\s\S]+?)\n\n--/,
  )
  if (anchorMatch) return anchorMatch[1].trim()

  // Fallback: any compact block (multiple short lines) before a page separator
  // that contains a date pattern — that's where the user data lives.
  const matches = [...text.matchAll(/\n\n((?:[^\n]{1,60}\n){2,8})\n\n--\s*\d+/g)]
  for (const m of matches) {
    if (/\d{2}\/\d{2}\/\d{4}/.test(m[1])) return m[1].trim()
  }

  return text
}

export function parseAca3Text(text: string): {
  formData: Partial<ApplicationFormData>
  fieldsFound: string[]
} {
  const formData: Partial<ApplicationFormData> = {}
  const fieldsFound: string[] = []

  function set(key: keyof ApplicationFormData, value: string) {
    const v = value.trim().replace(/\s{2,}/g, " ")
    if (!v) return
    ;(formData as Record<string, unknown>)[key] = v
    if (!fieldsFound.includes(key)) fieldsFound.push(key)
  }

  const block = extractDataBlock(text)

  // ── 1. Name + DOB ────────────────────────────────────────────────────────
  // Pattern: "Alex M Carter 07/14/1991" — name parts then DOB on one line.
  // Use * (not +) after first char so single-letter middle initials ("M") are allowed.
  const nameDobRe =
    /([A-Z][a-zA-Z'-]*(?:[ \t]+[A-Z][a-zA-Z'-]*){1,4})[ \t]+(\d{2}\/\d{2}\/\d{4})/
  const nameDobMatch = block.match(nameDobRe)
  if (nameDobMatch) {
    const parts = nameDobMatch[1].trim().split(/\s+/)
    if (parts.length >= 2) {
      set("firstName", parts[0])
      set("lastName", parts[parts.length - 1])
    }
    set("dob", nameDobMatch[2])
  } else {
    // DOB alone (name on a different line)
    const dobMatch = block.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)
    if (dobMatch) set("dob", dobMatch[1])
  }

  // ── 2. Email ─────────────────────────────────────────────────────────────
  // Only search the data block to avoid matching form-template addresses.
  const emailMatch = block.match(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/)
  if (emailMatch) set("email", emailMatch[1].toLowerCase())

  // ── 3. Street address ─────────────────────────────────────────────────────
  // A line beginning with a house number, e.g. "123 Maple Street".
  // Use [ \t] (not \s) to avoid spanning newlines ("1991\n123 Maple St" false match).
  const STREET_SUFFIXES =
    "Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Place|Pl|" +
    "Court|Ct|Terrace|Ter|Circle|Cir|Highway|Hwy|Parkway|Pkwy|Trail|Trl|Square|Sq"
  const streetRe = new RegExp(
    `^(\\d{1,5}[ \\t]+(?:[A-Za-z0-9#.'\\-]+[ \\t]+){0,5}(?:${STREET_SUFFIXES})\\.?)\\s*$`,
    "im",
  )
  const streetMatch = block.match(streetRe)
  if (streetMatch) set("address", streetMatch[1])

  // ── 4. City + ZIP + County ────────────────────────────────────────────────
  // Pattern: "Boston 02118 Suffolk" — city, 5-digit ZIP, county on one line.
  // Take the first match (home address), not the mailing address repeat.
  const cityZipCountyRe =
    /^([A-Za-z][A-Za-z ]{1,28}?)[ \t]+(\d{5})[ \t]+([A-Za-z][A-Za-z ]{1,24}?)[ \t]*$/m
  const czMatch = block.match(cityZipCountyRe)
  if (czMatch) {
    set("city", czMatch[1])
    set("zip", czMatch[2])
    set("county", czMatch[3])
  }

  // State defaults to MA — this is a MassHealth form
  if (!formData.state) set("state", "MA")

  // ── 5. Phone ──────────────────────────────────────────────────────────────
  // Only match in the data block to avoid form-template hotline/fax numbers.
  const phoneRe =
    /\((\d{3})\)[ \t]*(\d{3})[\s\-](\d{4})|\b(\d{3})[\s.\-](\d{3})[\s.\-](\d{4})\b/
  const phoneMatch = block.match(phoneRe)
  if (phoneMatch) set("phone", phoneMatch[0])

  // ── 6. Preferred spoken language ─────────────────────────────────────────
  // "English" (or other language) appears on its own line in the data block.
  const knownLanguages = [
    "English", "Spanish", "Español", "Portuguese", "Chinese", "Mandarin",
    "Cantonese", "Haitian Creole", "Kreyòl", "Vietnamese", "Arabic",
    "French", "Khmer", "Korean", "Russian", "Cape Verdean Creole",
    "Polish", "Italian", "Greek", "Somali", "Albanian",
  ]
  const langRe = new RegExp(`^(${knownLanguages.join("|")})[ \\t]*$`, "im")
  const langMatch = block.match(langRe)
  if (langMatch) set("preferredSpokenLanguage", langMatch[1])

  return { formData, fieldsFound }
}
