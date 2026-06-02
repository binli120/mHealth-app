import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { updateGlossaryTerm, deleteGlossaryTerm } from "@/lib/glossary/db"
import { logServerError } from "@/lib/server/logger"
import { z } from "zod"

const UpdateSchema = z.object({
  term_en: z.string().min(1).optional(),
  definition_en: z.string().min(1).optional(),
  definition_es: z.string().optional(),
  category: z.enum(["program", "insurance", "aca", "medical"]).optional(),
  aliases: z.array(z.string()).optional(),
  related_slugs: z.array(z.string()).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400 })
    }
    const term = await updateGlossaryTerm(slug, parsed.data)
    if (!term) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json({ term })
  } catch (err) {
    logServerError(`PATCH /api/admin/glossary/${slug}`, err)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const deleted = await deleteGlossaryTerm(slug)
    if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logServerError(`DELETE /api/admin/glossary/${slug}`, err)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
