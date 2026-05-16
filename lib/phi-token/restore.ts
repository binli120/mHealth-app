"use client"

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { decryptStorageDraft, mergePhiIntoState } from "@/lib/phi-token/token"

interface RestorePhiDraftStateParams {
  applicationId: string
  resumeId: string
  serverState: Record<string, unknown>
  keyBase64?: string
  actingForPatientId?: string
}

interface PhiDraftApiResponse {
  ok?: boolean
  encryptedBlob?: string
  aesKeyBase64?: string | null
  error?: string
}

export async function restorePhiDraftState({
  applicationId,
  resumeId,
  serverState,
  keyBase64,
  actingForPatientId,
}: RestorePhiDraftStateParams): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {}
  if (actingForPatientId) {
    headers["X-Acting-For-Patient"] = actingForPatientId
  }

  const response = await authenticatedFetch(
    `/api/applications/${encodeURIComponent(applicationId)}/phi-draft?resumeId=${encodeURIComponent(resumeId)}`,
    {
      cache: "no-store",
      headers,
    },
  )
  const payload = (await response.json().catch(() => ({}))) as PhiDraftApiResponse

  if (!response.ok || !payload.ok) {
    throw new Error(response.status === 404 ? "Resume data not found." : payload.error || "Failed to load draft.")
  }

  if (!payload.encryptedBlob) {
    throw new Error("Resume data is missing encrypted content.")
  }

  const resolvedKey = keyBase64?.trim() || payload.aesKeyBase64?.trim() || ""
  if (!resolvedKey) {
    throw new Error("Encryption key not available.")
  }

  const phiPayload = await decryptStorageDraft(payload.encryptedBlob, resolvedKey)
  return mergePhiIntoState(serverState, phiPayload)
}
