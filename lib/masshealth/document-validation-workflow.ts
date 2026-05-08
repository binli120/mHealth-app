import "server-only"

import { getApplicationDraft } from "@/lib/db/application-drafts"
import {
  insertDocumentExtraction,
  type DocumentRecord,
  updateDocumentValidation,
} from "@/lib/db/documents"
import {
  analyzeAndValidateDocument,
  type DocumentAnalysisOutcome,
} from "@/lib/masshealth/document-analysis-client"

export async function validateUploadedDocument(params: {
  userId: string
  document: DocumentRecord
  file: File
  backFile?: File | null
  mimeType: string
}): Promise<DocumentRecord> {
  const draft = await getApplicationDraft(params.userId, params.document.applicationId).catch(() => null)
  const outcome = await analyzeAndValidateDocument({
    userId: params.userId,
    documentType: params.document.documentType,
    documentLabel: params.document.requiredDocumentLabel,
    file: params.file,
    backFile: params.backFile,
    mimeType: params.mimeType,
    draft,
  })

  if (outcome.rawOutput || outcome.summary) {
    await insertDocumentExtraction({
      documentId: params.document.id,
      modelName: `masshealth-image-analysis/${outcome.analysisDocumentType ?? "unknown"}`,
      rawOutput: outcome.rawOutput,
      structuredOutput: outcome.summary,
      confidenceScore: outcome.status === "valid" ? 100 : outcome.status === "invalid" ? 50 : null,
    }).catch(() => undefined)
  }

  return updateFromOutcome(params.document, outcome)
}

async function updateFromOutcome(
  document: DocumentRecord,
  outcome: DocumentAnalysisOutcome,
): Promise<DocumentRecord> {
  const updated = await updateDocumentValidation({
    documentId: document.id,
    documentStatus: outcome.documentStatus,
    validationStatus: outcome.status,
    analysisDocumentType: outcome.analysisDocumentType,
    validationError: outcome.error,
    validationSummary: outcome.summary,
    validationCertificate: outcome.certificate,
  })

  return updated ?? document
}
