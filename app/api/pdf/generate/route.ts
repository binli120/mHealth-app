/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { generateMassHealthAcaPdf } from "@/lib/pdf/masshealth-aca"
import { massHealthAcaPayloadSchema } from "@/lib/pdf/masshealth-aca-payload"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

const requestSchema = z.object({
  formType: z.literal("aca-3-0325").optional().default("aca-3-0325"),
  filename: z.string().trim().min(1).optional(),
  data: massHealthAcaPayloadSchema,
})

function sanitizeFilename(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "-")
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const body = await request.json()
    const payload = requestSchema.parse(body)

    const pdfBytes = await generateMassHealthAcaPdf(payload.data)
    const defaultFilename = `${payload.formType}-generated-${new Date().toISOString().slice(0, 10)}.pdf`
    const filename = payload.filename ? sanitizeFilename(payload.filename) : defaultFilename

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    logServerError("Failed to generate PDF from JSON", error, {
      route: "/api/pdf/generate",
      method: "POST",
    })

    const isValidationError = error instanceof z.ZodError

    return NextResponse.json(
      {
        error: isValidationError
          ? "Invalid PDF generation payload."
          : "Unable to generate PDF from JSON payload",
      },
      {
        status: isValidationError ? 422 : 500,
      },
    )
  }
}
