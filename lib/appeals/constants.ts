import type { DenialReasonOption } from "./types"

export const APPEAL_DENIAL_REASONS: DenialReasonOption[] = [
  {
    id: "missing_disability_proof",
    label: "Missing proof of disability",
    description:
      "The applicant could not provide sufficient documentation of a qualifying disability.",
  },
  {
    id: "income_exceeds_limit",
    label: "Income exceeds eligibility limit",
    description:
      "The household's reported income was above the threshold for the requested program.",
  },
  {
    id: "residency_not_verified",
    label: "Residency not verified",
    description:
      "The applicant could not prove Massachusetts residency with acceptable documents.",
  },
  {
    id: "citizenship_immigration",
    label: "Citizenship / immigration status issue",
    description:
      "The applicant's citizenship or immigration status was not verified or does not meet program requirements.",
  },
  {
    id: "age_not_eligible",
    label: "Age not eligible for program category",
    description:
      "The applicant's age falls outside the qualifying range for the requested program track.",
  },
  {
    id: "already_enrolled",
    label: "Already enrolled in other coverage",
    description:
      "MassHealth determined the applicant has other qualifying coverage that disqualifies them.",
  },
  {
    id: "missing_documentation",
    label: "Missing required documentation",
    description:
      "The application was incomplete due to one or more missing required documents.",
  },
  {
    id: "ssn_not_verified",
    label: "Social Security Number not verified",
    description: "The SSN provided could not be verified against federal records.",
  },
  {
    id: "other",
    label: "Other (describe below)",
    description: "A denial reason not listed above — see applicant-provided details.",
  },
]

export const APPEAL_DENIAL_REASON_IDS = [
  "missing_disability_proof",
  "income_exceeds_limit",
  "residency_not_verified",
  "citizenship_immigration",
  "age_not_eligible",
  "already_enrolled",
  "missing_documentation",
  "ssn_not_verified",
  "other",
] as const

export const APPEAL_DETAILS_MAX_LENGTH = 1000
export const APPEAL_RAG_TOP_K = 3

// Document upload
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
export const ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const ACCEPTED_DOCUMENT_MIME_TYPES = [...ACCEPTED_IMAGE_MIME_TYPES, "application/pdf"] as const

// Vision model for image-based denial letter extraction
// Uses a separate model from the chat model so it can be configured independently
export const DEFAULT_OLLAMA_VISION_MODEL = "llama3.2-vision"

export const ERROR_APPEAL_INVALID_PAYLOAD = "Invalid request payload."
export const ERROR_APPEAL_OLLAMA_FAILED = "Unable to generate appeal analysis."
export const ERROR_APPEAL_LOG_PREFIX = "Appeal analyze route failed"
export const ERROR_DOCUMENT_MISSING = "No file was uploaded."
export const ERROR_DOCUMENT_TOO_LARGE = "File exceeds the 10 MB limit."
export const ERROR_DOCUMENT_INVALID_TYPE = "Only images (JPEG, PNG, WEBP) and PDF files are accepted."
export const ERROR_DOCUMENT_EXTRACT_FAILED = "Unable to extract text from document."
export const ERROR_DOCUMENT_LOG_PREFIX = "Appeal extract-document route failed"
