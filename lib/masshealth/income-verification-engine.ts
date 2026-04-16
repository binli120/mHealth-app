/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Deterministic income verification engine.
 *
 * BOUNDARY CONTRACT:
 *   - This module owns: required-doc routing, freshness rules, person-to-document
 *     matching, frequency normalization, amount tolerance, and the final
 *     incomeVerified flag.
 *   - The LLM/OCR layer owns: classification, field extraction, explanation text.
 *   - The model must NEVER decide whether proof is legally sufficient.
 */

import type {
  IncomeSourceType,
  IncomeDocType,
  IncomeVerificationStatus,
  IncomeVerificationCaseStatus,
  IncomeEvidenceRequirement,
  IncomeDocumentExtraction,
  IncomeChecklistMember,
} from "./types"

// ── Accepted document types per income source ─────────────────────────────────
// Aligned with MassHealth Acceptable Verifications List.

const ACCEPTED_DOC_TYPES: Record<IncomeSourceType, IncomeDocType[]> = {
  employment:        ["pay_stub", "employer_statement", "w2"],
  self_employment:   ["profit_loss_statement", "self_employment_form", "form_1099"],
  tax_return:        ["tax_return", "w2", "form_1099"],
  w2:                ["w2"],
  form_1099:         ["form_1099"],
  unemployment:      ["unemployment_letter"],
  social_security:   ["social_security_letter"],
  pension_annuity:   ["pension_statement"],
  rental:            ["rental_agreement"],
  interest_dividend: ["interest_statement", "form_1099"],
  zero_income:       ["zero_income_affidavit", "attestation_form"],
}

// ── Freshness rules (max document age in calendar days) ───────────────────────

const FRESHNESS_DAYS: Partial<Record<IncomeDocType, number>> = {
  pay_stub:              45,
  employer_statement:    45,
  unemployment_letter:   45,
  profit_loss_statement: 90,
  self_employment_form:  90,
  zero_income_affidavit: 90,
  attestation_form:      90,
  pension_statement:     90,
  social_security_letter: 365,
  rental_agreement:      365,
  w2:                    400,  // ~13 months, prior tax year acceptable
  form_1099:             400,
  tax_return:            400,
  interest_statement:    400,
}

const DEFAULT_FRESHNESS_DAYS = 90

// ── Amount consistency tolerance ──────────────────────────────────────────────

/**
 * Extracted amount may differ from self-reported by at most this fraction
 * before triggering manual_review.  15% covers rounding and partial-period pay.
 */
const AMOUNT_TOLERANCE = 0.15

// ── Confidence thresholds ──────────────────────────────────────────────────────

const CONFIDENCE_UNREADABLE   = 0.30   // below → needs_additional_document
const CONFIDENCE_MANUAL_REVIEW = 0.70  // below → manual_review

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Return the document types MassHealth accepts for a given income source.
 * Falls back to attestation form if the source is unknown.
 */
export function acceptedDocTypesFor(source: IncomeSourceType): IncomeDocType[] {
  return ACCEPTED_DOC_TYPES[source] ?? ["attestation_form"]
}

/**
 * Build per-member, per-source evidence requirements from household intake data.
 * Called once after the income step is complete and stored via the checklist API.
 */
export function buildEvidenceRequirements(
  members: IncomeChecklistMember[],
): IncomeEvidenceRequirement[] {
  const requirements: IncomeEvidenceRequirement[] = []

  for (const member of members) {
    if (!member.hasIncome) {
      // Zero-income path: require affidavit or attestation form.
      requirements.push({
        id:                 `${member.memberId}:zero_income`,
        memberId:           member.memberId,
        memberName:         member.memberName,
        incomeSourceType:   "zero_income",
        acceptedDocTypes:   ACCEPTED_DOC_TYPES["zero_income"],
        isRequired:         true,
        verificationStatus: "pending",
      })
      continue
    }

    for (const source of member.incomeSources) {
      requirements.push({
        id:                 `${member.memberId}:${source}`,
        memberId:           member.memberId,
        memberName:         member.memberName,
        incomeSourceType:   source,
        acceptedDocTypes:   acceptedDocTypesFor(source),
        isRequired:         true,
        verificationStatus: "pending",
      })
    }
  }

  return requirements
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function documentAgeInDays(dateRangeEnd: string | null): number | null {
  if (!dateRangeEnd) return null
  const end = new Date(dateRangeEnd)
  if (isNaN(end.getTime())) return null
  return (Date.now() - end.getTime()) / (1000 * 60 * 60 * 24)
}

function isDocumentFresh(extraction: IncomeDocumentExtraction): boolean {
  const ageDays = documentAgeInDays(extraction.dateRangeEnd)
  if (ageDays === null) return false  // missing date → treat as stale

  const docType = extraction.docType
  const maxAge = docType ? (FRESHNESS_DAYS[docType] ?? DEFAULT_FRESHNESS_DAYS) : DEFAULT_FRESHNESS_DAYS
  return ageDays <= maxAge
}

/**
 * Normalize any pay frequency to a monthly amount for comparison.
 * Self-reported amounts are stored as monthly equivalents.
 */
export function normalizeToMonthly(
  amount: number,
  frequency: IncomeDocumentExtraction["frequency"],
): number {
  switch (frequency) {
    case "weekly":      return (amount * 52) / 12
    case "biweekly":    return (amount * 26) / 12
    case "semimonthly": return amount * 2
    case "monthly":     return amount
    case "annual":      return amount / 12
    default:            return amount
  }
}

function isAmountConsistent(
  selfReportedMonthly: number | null,
  extraction: IncomeDocumentExtraction,
): boolean {
  // If either side is absent we cannot refute — don't penalise.
  if (selfReportedMonthly === null || extraction.grossAmount === null) return true
  if (selfReportedMonthly === 0 && extraction.grossAmount === 0) return true

  const extractedMonthly = normalizeToMonthly(extraction.grossAmount, extraction.frequency)
  const baseline = Math.max(selfReportedMonthly, 1)
  return Math.abs(extractedMonthly - selfReportedMonthly) / baseline <= AMOUNT_TOLERANCE
}

/**
 * Loose name match: at least one word (3+ chars) shared between the document's
 * person name and the household member name.  Handles middle name omissions,
 * hyphenated names, and minor OCR errors.
 */
function namesOverlap(extracted: string | null, memberName: string): boolean {
  if (!extracted) return true  // absent → unverifiable, don't penalise here

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length >= 3)

  const eParts = normalize(extracted)
  const mParts = normalize(memberName)

  return eParts.some((w) => mParts.includes(w)) || mParts.some((w) => eParts.includes(w))
}

function isDocTypeAccepted(
  claimed: IncomeDocType | null,
  source: IncomeSourceType,
): boolean {
  if (!claimed) return false
  return acceptedDocTypesFor(source).includes(claimed)
}

// ── Core evaluation ───────────────────────────────────────────────────────────

export interface EvaluateDocumentInput {
  extraction:           IncomeDocumentExtraction
  selfReportedMonthly:  number | null
  incomeSource:         IncomeSourceType
  memberName:           string
}

/**
 * Deterministic per-document evaluation.  Returns a IncomeVerificationStatus
 * for the document's contribution toward a single income source.
 *
 * Decision ladder (first matching rule wins):
 *   1. Unreadable confidence → needs_additional_document
 *   2. Low confidence or model-flagged → manual_review
 *   3. Doc type not accepted for source → needs_additional_document
 *   4. Stale document → needs_additional_document
 *   5. Name mismatch → needs_clarification
 *   6. Amount inconsistency → manual_review
 *   7. All checks pass → verified
 */
export function evaluateDocumentEvidence(
  input: EvaluateDocumentInput,
): IncomeVerificationStatus {
  const { extraction, selfReportedMonthly, incomeSource, memberName } = input

  if (extraction.confidence < CONFIDENCE_UNREADABLE) {
    return "needs_additional_document"
  }

  if (extraction.confidence < CONFIDENCE_MANUAL_REVIEW || extraction.needsManualReview) {
    return "manual_review"
  }

  if (!isDocTypeAccepted(extraction.docType, incomeSource)) {
    return "needs_additional_document"
  }

  if (!isDocumentFresh(extraction)) {
    return "needs_additional_document"
  }

  if (!namesOverlap(extraction.personName, memberName)) {
    return "needs_clarification"
  }

  if (!isAmountConsistent(selfReportedMonthly, extraction)) {
    return "manual_review"
  }

  return "verified"
}

// ── Attestation paths ─────────────────────────────────────────────────────────

/**
 * An attestation or zero-income affidavit is accepted immediately but requires
 * a reviewer to confirm before the source is considered "verified".
 */
export function statusForAttestation(docType: IncomeDocType): IncomeVerificationStatus {
  if (docType === "zero_income_affidavit" || docType === "attestation_form") {
    return "attested_pending_review"
  }
  return "pending"
}

// ── Aggregate case computation ────────────────────────────────────────────────

export interface SourceDecision {
  memberId:   string
  sourceType: IncomeSourceType
  status:     IncomeVerificationStatus
}

export interface CaseAggregate {
  status:               IncomeVerificationCaseStatus
  incomeVerified:       boolean
  verifiedSourceCount:  number
  requiredSourceCount:  number
  decisionReason:       string | null
}

/**
 * Aggregate per-source decisions into an application-level verification case.
 *
 * incomeVerified is TRUE only when every required source reaches "verified".
 * Reviewer overrides flow through the same decision records.
 */
export function computeVerificationCase(
  requirements: IncomeEvidenceRequirement[],
  decisions:     SourceDecision[],
): CaseAggregate {
  const required = requirements.filter((r) => r.isRequired)
  const requiredSourceCount = required.length

  if (requiredSourceCount === 0) {
    return {
      status:              "verified",
      incomeVerified:      true,
      verifiedSourceCount: 0,
      requiredSourceCount: 0,
      decisionReason:      null,
    }
  }

  const decisionMap = new Map<string, IncomeVerificationStatus>()
  for (const d of decisions) {
    decisionMap.set(`${d.memberId}:${d.sourceType}`, d.status)
  }

  let verifiedCount     = 0
  let hasManualReview   = false
  let hasPendingDocs    = false
  let hasClarification  = false
  let hasAttested       = false

  for (const req of required) {
    const key    = `${req.memberId}:${req.incomeSourceType}`
    const status = decisionMap.get(key) ?? "pending"

    switch (status) {
      case "verified":
        verifiedCount++
        break
      case "manual_review":
        hasManualReview = true
        break
      case "needs_additional_document":
        hasPendingDocs = true
        break
      case "needs_clarification":
        hasClarification = true
        break
      case "attested_pending_review":
        hasAttested = true
        break
    }
  }

  const allVerified = verifiedCount === requiredSourceCount

  let caseStatus:     IncomeVerificationCaseStatus
  let decisionReason: string | null = null

  if (allVerified) {
    caseStatus = "verified"
  } else if (hasManualReview || hasAttested) {
    caseStatus = "manual_review"
    decisionReason = hasManualReview
      ? "One or more income sources require manual review."
      : "Attestation submitted; awaiting reviewer decision."
  } else if (hasPendingDocs || hasClarification) {
    caseStatus = "rfi_sent"
    decisionReason = hasPendingDocs
      ? "Additional documents are required for one or more income sources."
      : "Clarification is needed for submitted documents."
  } else {
    caseStatus = "pending_documents"
    decisionReason = "Income documents have not yet been submitted."
  }

  return {
    status:              caseStatus,
    incomeVerified:      allVerified,
    verifiedSourceCount: verifiedCount,
    requiredSourceCount,
    decisionReason,
  }
}

// ── RFI reason builder ────────────────────────────────────────────────────────

export interface RfiItem {
  memberId:    string
  memberName:  string
  sourceType:  IncomeSourceType
  status:      IncomeVerificationStatus
  docTypes:    IncomeDocType[]
}

/**
 * Build the precise missing-proof checklist for an RFI.
 * Only surfaces sources that are not yet "verified" or "attested_pending_review".
 */
export function buildRfiChecklist(
  requirements: IncomeEvidenceRequirement[],
  decisions:     SourceDecision[],
): RfiItem[] {
  const decisionMap = new Map<string, IncomeVerificationStatus>()
  for (const d of decisions) {
    decisionMap.set(`${d.memberId}:${d.sourceType}`, d.status)
  }

  return requirements
    .filter((req) => req.isRequired)
    .filter((req) => {
      const status = decisionMap.get(`${req.memberId}:${req.incomeSourceType}`) ?? "pending"
      return status !== "verified" && status !== "attested_pending_review"
    })
    .map((req) => ({
      memberId:   req.memberId,
      memberName: req.memberName,
      sourceType: req.incomeSourceType,
      status:     decisionMap.get(`${req.memberId}:${req.incomeSourceType}`) ?? "pending",
      docTypes:   req.acceptedDocTypes,
    }))
}
