import { NextResponse } from "next/server"
import { extractPdfJson } from "@/lib/pdf/extract-pdf-json"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File
}

function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") {
    return true
  }

  if ((!file.type || file.type === "application/octet-stream") && file.name?.toLowerCase().endsWith(".pdf")) {
    return true
  }

  return false
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

    if (uploaded.size === 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 })
    }

    if (uploaded.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Uploaded file exceeds the 10 MB limit." },
        { status: 413 },
      )
    }

    if (!isPdfFile(uploaded)) {
      return NextResponse.json({ error: "Uploaded file must be a PDF." }, { status: 400 })
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
