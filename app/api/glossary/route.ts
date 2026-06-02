import { NextResponse } from "next/server"
import { getAllGlossaryIndex, seedGlossaryTerms } from "@/lib/glossary/db"
import { logServerError } from "@/lib/server/logger"

export const revalidate = 3600

export async function GET() {
  try {
    let terms = await getAllGlossaryIndex()
    if (terms.length === 0) {
      await seedGlossaryTerms()
      terms = await getAllGlossaryIndex()
    }
    return NextResponse.json({ terms })
  } catch (err) {
    logServerError("GET /api/glossary", err)
    return NextResponse.json({ terms: [] })
  }
}
