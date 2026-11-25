/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { uuidSchema } from "@/lib/api/validation"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getApplicationDraft } from "@/lib/db/application-drafts"
import { isSaca2Enabled } from "@/lib/masshealth/saca2/flag"
import { countSubstitutions } from "@/lib/masshealth/saca2/pdf/encoders"
import { Saca2FitError } from "@/lib/masshealth/saca2/pdf/fit-error"
import { fillSaca2Pdf } from "@/lib/masshealth/saca2/pdf/pdf-fill"
import { Saca2TemplateIntegrityError, loadSaca2Template } from "@/lib/masshealth/saca2/pdf/template"
import { normalizeSaca2State } from "@/lib/masshealth/saca2/wizard-state"
import { logServerError } from "@/lib/server/logger"
import { checkRateLimitAsync, saca2FillLimiter } from "@/lib/server/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 200 * 1024
const LOG_EVENT = "Failed to fill the SACA-2 PDF"

const bodySchema = z.object({
  applicationId: uuidSchema,
  wizardState: z.record(z.unknown()),
})

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status })
}

const tooLarge = () => fail("Request body too large.", 413)

/** Reads the body up to the limit; null when it is larger. Content-Length can be absent or wrong, so count what arrives. */
async function readBodyCapped(request: Request): Promise<string | null> {
  if (!request.body) return ""
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

export async function POST(request: Request) {
  let userId: string | undefined
  let applicationId: string | undefined
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response
    userId = authResult.userId

    if (!isSaca2Enabled()) return fail("Not found.", 404)

    const rlResponse = await checkRateLimitAsync(saca2FillLimiter, `saca2-fill:${userId}`)
    if (rlResponse) return rlResponse

    const declared = Number(request.headers.get("content-length"))
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return tooLarge()
    const rawBody = await readBodyCapped(request)
    if (rawBody === null) return tooLarge()

    let json: unknown
    try {
      json = JSON.parse(rawBody)
    } catch {
      return fail("Request body must be valid JSON.", 400)
    }
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) return fail("Invalid request.", 422)
    applicationId = parsed.data.applicationId

    const actingFor = request.headers.get("X-Acting-For-Patient") ?? undefined
    const record = await getApplicationDraft(userId, applicationId, actingFor)
    if (!record) return fail("Application not found.", 404)
    if (record.applicationType !== "saca2") return fail("This application is not a SACA-2 application.", 409)

    const state = normalizeSaca2State(parsed.data.wizardState)
    if (!state) return fail("The application answers are not valid.", 422)

    const template = await loadSaca2Template()
    const { result: bytes, count: substituted } = await countSubstitutions(() =>
      fillSaca2Pdf(state.data, template, new Date()),
    )
    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="SACA-2-application.pdf"',
      "Cache-Control": "no-store",
    }
    // Characters the form's font cannot print came out as "?": tell the client (a count only, never the text).
    if (substituted > 0) headers["X-Saca2-Substituted-Chars"] = String(substituted)
    return new Response(Buffer.from(bytes), { status: 200, headers })
  } catch (error) {
    // Only ids go to the log: never the body or the answers.
    logServerError(LOG_EVENT, error, { module: "saca2-fill", userId, applicationId })
    if (error instanceof Saca2TemplateIntegrityError) {
      return fail("The application template could not be verified.", 500)
    }
    if (error instanceof Saca2FitError) {
      return fail("Some answers could not be placed on the form.", 422)
    }
    return fail("Unable to generate the SACA-2 PDF.", 500)
  }
}
