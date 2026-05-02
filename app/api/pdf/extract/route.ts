/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { extractPdfJson } from "@/lib/pdf/extract-pdf-json"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import { validateUpload } from "@/lib/uploads/validate"

export const runtime = "nodejs"

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== "string"
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const formData = await request.formData()
    const uploaded = formData.get("file")

    if (!isUploadedFile(uploaded)) {
      return NextResponse.json({ error: "Missing file upload. Use multipart/form-data with field 'file'." }, { status: 400 })
    }

    const validation = await validateUpload(uploaded, "pdf")
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: validation.status })
    }

    const bytes = new Uint8Array(await uploaded.arrayBuffer())
    const data = await extractPdfJson({
      bytes,
      fileName: uploaded.name || "uploaded.pdf",
      fileSize: uploaded.size,
    })

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    logServerError("Failed to extract JSON from PDF", error, {
      route: "/api/pdf/extract",
      method: "POST",
    })

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to extract JSON from uploaded PDF",
      },
      {
        status: 500,
      },
    )
  }
}
