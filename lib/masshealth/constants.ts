/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Shared constants for the MassHealth modules.
 */

// ── MassHealth contact info ───────────────────────────────────────────────────

export const MASSHEALTH_PHONE = "1-800-841-2900"
export const MASSHEALTH_TTY = "711"
/** MassHealth direct TTY line (for D/HH applicants who don't use the relay service). */
export const MASSHEALTH_TTY_DIRECT = "1-800-497-4648"
export const MASSHEALTH_SERVICE_HOURS = "Monday-Friday, 8:00 a.m.-5:00 p.m."

// ── ACA-3 eligibility: Federal Poverty Level (FY 2026) ────────────────────────

/** FPL base amounts indexed by household size (1–4 persons). */
export const FPL_TABLE_2026: Record<number, number> = {
  1: 15060,
  2: 20440,
  3: 25820,
  4: 31200,
}

/** Additional FPL dollars per person beyond household size 4. */
export const FPL_INCREMENT_AFTER_4 = 5380

// ── MassHealth / ACA program FPL eligibility thresholds (% of FPL) ───────────
//
// Changing these changes legal eligibility boundaries — update only when
// Massachusetts publishes new annual policy guidance.

/** MassHealth Standard for adults with a documented disability (SSI/SSDI path). */
export const FPL_PCT_ADULT_DISABILITY = 133

/**
 * MassHealth CarePlus upper bound for adults 19–64.
 * Derived from the ACA Medicaid expansion: 133% + 5% income disregard = 138%.
 */
export const FPL_PCT_CAREPLUS = 138

/** MassHealth Standard for children under 19. */
export const FPL_PCT_CHILD_STANDARD = 150

/** MassHealth Standard for pregnant individuals. */
export const FPL_PCT_PREGNANCY_STANDARD = 200

/**
 * MassHealth Family Assistance / ConnectorCare upper bound.
 * Children 150–300% FPL → Family Assistance (CHIP).
 * Adults 138–300% FPL → ConnectorCare subsidised plans.
 */
export const FPL_PCT_FAMILY_ASSIST = 300

/**
 * Federal Advance Premium Tax Credit (APTC) upper bound.
 * Households 300–500% FPL may qualify for federal marketplace subsidies.
 * Above 500% → likely unsubsidised employer or marketplace plans.
 */
export const FPL_PCT_TAX_CREDITS_UPPER = 500

// ── Fact extraction (LLM call config) ────────────────────────────────────────

/** Ollama sampling temperature for JSON fact extraction (deterministic). */
export const EXTRACT_TEMPERATURE = 0

/** Abort timeout in milliseconds for the Ollama fact-extraction call. */
export const EXTRACT_TIMEOUT_MS = 30_000

/** Max number of recent messages to include in the extraction prompt. */
export const EXTRACT_MESSAGE_WINDOW = 10

// ── MassHealth forms service (extract-workflow client) ────────────────────────

/** Fallback base URL used in non-production when NEXT_PUBLIC_MASSHEALTH_FORMS_BASE_URL is unset. */
export const MASSHEALTH_FORMS_DEV_BASE_URL = "http://localhost:8000"

/** Path to the MassHealth forms extract-workflow endpoint. */
export const MASSHEALTH_FORMS_EXTRACT_PATH = "/masshealth/forms/extract-workflow"

/** Path to the MassHealth analysis service auto-extraction endpoint. */
export const MASSHEALTH_ANALYSIS_EXTRACT_AUTO_PATH = "/masshealth/extract/auto"

/** Path to the MassHealth analysis service driver-license image validation endpoint. */
export const MASSHEALTH_DRIVER_LICENSE_ANALYSIS_PATH =
  process.env.NEXT_PUBLIC_MASSHEALTH_DRIVER_LICENSE_ANALYSIS_PATH ??
  "/identity/driver-license/analyze"
