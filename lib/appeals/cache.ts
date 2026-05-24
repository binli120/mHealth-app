/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Server-only helpers for persisting and retrieving cached appeal analyses.
 * The cache key is (user_id, denial_reason_id, sha256(denialDetails + documentText))
 * so re-submitting the same document immediately returns the stored result.
 */

import "server-only"

import { createHash } from "crypto"
import { getSupabaseAdminClient } from "@/lib/supabase/server"
import type { AppealAnalysis, DenialReasonId } from "./types"

/** Deterministic SHA-256 fingerprint of the user-supplied inputs. */
export function computeInputHash(
  denialDetails: string,
  documentText: string | undefined,
): string {
  return createHash("sha256")
    .update(denialDetails + "\x00" + (documentText ?? ""))
    .digest("hex")
}

/**
 * Minimum character length for an `appealLetter` to be considered valid.
 * Entries shorter than this were produced by a truncated model response
 * (e.g. just a date line) and must be regenerated.
 */
export const MIN_APPEAL_LETTER_LENGTH = 200

/**
 * Returns a previously stored analysis, or `null` on cache miss, error, or
 * when the stored letter is too short to be a real appeal (stale/bad entry).
 * Returning `null` causes the route to re-run the AI pipeline and overwrite
 * the bad row via the upsert in `saveAppealAnalysis`.
 */
export async function getCachedAppealAnalysis(
  userId: string,
  denialReasonId: DenialReasonId,
  inputHash: string,
): Promise<AppealAnalysis | null> {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("appeal_analyses")
      .select("explanation, appeal_letter, evidence_checklist")
      .eq("user_id", userId)
      .eq("denial_reason_id", denialReasonId)
      .eq("input_hash", inputHash)
      .maybeSingle()

    if (error || !data) return null

    const appealLetter = data.appeal_letter as string

    // Reject stale entries produced by the quality-gate truncation bug.
    if (appealLetter.length < MIN_APPEAL_LETTER_LENGTH) return null

    return {
      explanation: data.explanation as string,
      appealLetter,
      evidenceChecklist: (data.evidence_checklist ?? []) as string[],
    }
  } catch {
    return null
  }
}

/**
 * Upserts an analysis result for the given user + input combination.
 * Failures are silently swallowed — caching is best-effort.
 */
export async function saveAppealAnalysis(
  userId: string,
  denialReasonId: DenialReasonId,
  inputHash: string,
  analysis: AppealAnalysis,
): Promise<void> {
  try {
    await getSupabaseAdminClient()
      .from("appeal_analyses")
      .upsert(
        {
          user_id: userId,
          denial_reason_id: denialReasonId,
          input_hash: inputHash,
          explanation: analysis.explanation,
          appeal_letter: analysis.appealLetter,
          evidence_checklist: analysis.evidenceChecklist,
        },
        { onConflict: "user_id,denial_reason_id,input_hash" },
      )
  } catch {
    // Non-fatal: the user still gets a fresh result this request.
  }
}
