import { NextResponse } from "next/server"
import { z } from "zod"
import { generateMassHealthAcaPdf } from "@/lib/pdf/masshealth-aca"
import { massHealthAcaPayloadSchema } from "@/lib/pdf/masshealth-aca-payload"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const body = await request.json()
    const payload = massHealthAcaPayloadSchema.parse(body)

    const pdfBytes = await generateMassHealthAcaPdf(payload)
    const filename = `ACA-3-0325-filled-${new Date().toISOString().slice(0, 10)}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Failed to generate ACA PDF", error)

    const isValidationError = error instanceof z.ZodError

    return NextResponse.json(
      {
        error: isValidationError ? "Invalid ACA form payload." : "Unable to generate filled ACA PDF",
      },
      {
        status: isValidationError ? 422 : 500,
      },
    )
  }
}
