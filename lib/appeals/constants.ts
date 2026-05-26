/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

export const APPEAL_DETAILS_MAX_LENGTH = 1000

// A full appeal letter JSON (explanation + formal letter + checklist) easily
// exceeds 1024 tokens.  Use a dedicated higher limit so the model is never
// forced to truncate the letter mid-stream.
export const APPEAL_ANALYZE_MAX_OUTPUT_TOKENS = 3000

// The appeal pipeline (RAG + generation + quality gate) takes 30–90 s on
// local hardware.  Use a dedicated timeout that is well above the chat
// timeout so an AbortError never surfaces as a 500 on a slow second run.
export const APPEAL_ANALYZE_TIMEOUT_MS = 120_000

// Document upload
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
export const ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const ACCEPTED_DOCUMENT_MIME_TYPES = [...ACCEPTED_IMAGE_MIME_TYPES, "application/pdf"] as const

// OCR/vision model for image-based denial letter extraction.
// glm-ocr is an Ollama model tuned for document OCR and produces better results
// than general vision models on scanned government letters.
export const DEFAULT_OLLAMA_VISION_MODEL = "glm-ocr:latest"

export const ERROR_APPEAL_INVALID_PAYLOAD = "Invalid request payload."
export const ERROR_APPEAL_OLLAMA_FAILED = "Unable to generate appeal analysis."
export const ERROR_APPEAL_LOG_PREFIX = "Appeal analyze route failed"
export const ERROR_DOCUMENT_MISSING = "No file was uploaded."
export const ERROR_DOCUMENT_TOO_LARGE = "File exceeds the 10 MB limit."
export const ERROR_DOCUMENT_INVALID_TYPE = "Only images (JPEG, PNG, WEBP) and PDF files are accepted."
export const ERROR_DOCUMENT_EXTRACT_FAILED = "Unable to extract text from document."
export const ERROR_DOCUMENT_LOG_PREFIX = "Appeal extract-document route failed"
