/**
 * GET /api/cron/purge-identity-extractions
 *
 * Data-minimization cron job: NULLs raw extraction fields that are older than
 * RETENTION_DAYS.  Vercel invokes this route on the schedule defined in
 * vercel.json and injects `Authorization: Bearer <CRON_SECRET>`.
 *
 * Fields purged:
 *   mobile_verify_sessions.extracted_data     — parsed AAMVA fields (name, address)
 *   identity_verification_attempts.ip_address — client IP at verification time
 *   identity_verification_attempts.user_agent — client UA at verification time
 *   document_extractions.raw_output           — unstructured OCR / model output
 *   document_extractions.structured_output    — processed extraction output
 *   document_pages.ocr_text                   — raw OCR text (via documents.uploaded_at)
 *
 * Structured results (scores, breakdown booleans, hashed DL number) are kept
 * indefinitely for audit purposes.
 *
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db/server"
import { logServerError, logServerInfo } from "@/lib/server/logger"

export const runtime = "nodejs"

const RETENTION_DAYS = 30

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret) {
    return request.headers.get("authorization") === `Bearer ${secret}`
  }
  // No secret configured — allow only local invocations (dev / manual testing).
  const host = request.headers.get("host") ?? ""
  return host.startsWith("localhost") || host.startsWith("127.0.0.1")
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pool = getDbPool()
  const retentionInterval = `${RETENTION_DAYS} days`

  try {
    // 1. mobile_verify_sessions — AAMVA-parsed fields (name, address, etc.)
    const { rowCount: mobileRows } = await pool.query(
      `UPDATE public.mobile_verify_sessions
          SET extracted_data = NULL
        WHERE extracted_data IS NOT NULL
          AND created_at < NOW() - $1::INTERVAL`,
      [retentionInterval],
    )

    // 2. identity_verification_attempts — client IP + user-agent string
    const { rowCount: attemptsRows } = await pool.query(
      `UPDATE public.identity_verification_attempts
          SET ip_address  = NULL,
              user_agent  = NULL
        WHERE (ip_address IS NOT NULL OR user_agent IS NOT NULL)
          AND attempted_at < NOW() - $1::INTERVAL`,
      [retentionInterval],
    )

    // 3. document_extractions — unstructured OCR / model output
    const { rowCount: extractionRows } = await pool.query(
      `UPDATE public.document_extractions
          SET raw_output        = NULL,
              structured_output = NULL
        WHERE (raw_output IS NOT NULL OR structured_output IS NOT NULL)
          AND extracted_at < NOW() - $1::INTERVAL`,
      [retentionInterval],
    )

    // 4. document_pages — raw OCR text (age derived from parent documents.uploaded_at)
    const { rowCount: pageRows } = await pool.query(
      `UPDATE public.document_pages dp
          SET ocr_text = NULL
         FROM public.documents d
        WHERE dp.document_id = d.id
          AND dp.ocr_text    IS NOT NULL
          AND d.uploaded_at  < NOW() - $1::INTERVAL`,
      [retentionInterval],
    )

    const purged = {
      mobileSessionsExtractedData:    mobileRows     ?? 0,
      identityAttemptsIpAndUserAgent: attemptsRows   ?? 0,
      documentExtractionsRawOutput:   extractionRows ?? 0,
      documentPagesOcrText:           pageRows       ?? 0,
    }

    logServerInfo("Identity extraction purge complete", {
      retentionDays: RETENTION_DAYS,
      ...purged,
    })

    return NextResponse.json({ ok: true, purged })
  } catch (error) {
    logServerError("Identity extraction purge failed", error, {
      module: "api/cron/purge-identity-extractions",
    })
    return NextResponse.json({ ok: false, error: "Purge failed." }, { status: 500 })
  }
}
