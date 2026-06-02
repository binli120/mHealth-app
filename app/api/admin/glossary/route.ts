import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createGlossaryTerm, getAllGlossaryTerms } from "@/lib/glossary/db"
import { logServerError } from "@/lib/server/logger"
import { z } from "zod"

const CreateSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  term_en: z.string().min(1),
  definition_en: z.string().min(1),
  definition_es: z.string().optional(),
  category: z.enum(["program", "insurance", "aca", "medical"]),
  aliases: z.array(z.string()).default([]),
  related_slugs: z.array(z.string()).default([]),
})

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const terms = await getAllGlossaryTerms()
    return NextResponse.json({ terms })
  } catch (err) {
    logServerError("GET /api/admin/glossary", err)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400 })
    }
    const term = await createGlossaryTerm(parsed.data)
    return NextResponse.json({ term }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      return NextResponse.json({ error: "slug_conflict" }, { status: 409 })
    }
    logServerError("POST /api/admin/glossary", err)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
