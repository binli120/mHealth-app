import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import { ingestDocument, ingestAllDocuments, POLICY_SOURCES } from "@/lib/rag/ingest"
import { DOC_TYPES } from "@/lib/rag/constants"
import type { DocumentSource } from "@/lib/rag/types"

export const runtime = "nodejs"
// Allow up to 5 minutes — PDF fetch + chunking + embedding can be slow
export const maxDuration = 300

/**
 * POST /api/rag/ingest
 *
 * Staff-only endpoint to ingest MassHealth policy documents into the
 * pgvector store. Protected by two layers:
 *  1. Authenticated user session (requireAuthenticatedUser)
 *  2. Secret admin key header (X-Ingest-Key must match RAG_INGEST_SECRET env var)
 *
 * Body (optional):
 *   {}                          → ingest all POLICY_SOURCES
 *   { url, title, doc_type }    → ingest a single custom document
 *
 * Returns:
 *   { ok: true, ingested: number, totalChunks: number, results: [...] }
 */

const singleDocSchema = z.object({
  url:      z.string().url(),
  title:    z.string().min(1).max(200),
  doc_type: z.enum(DOC_TYPES).default("faq"),
  language: z.string().length(2).default("en"),
})

export async function POST(request: Request) {
  // ── Auth: must be authenticated ──────────────────────────────────────────
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) {
    return authResult.response
  }

  // ── Auth: must supply ingest secret (protects against non-staff users) ───
  const ingestSecret = process.env.RAG_INGEST_SECRET
  if (ingestSecret) {
    const providedKey = request.headers.get("x-ingest-key")
    if (providedKey !== ingestSecret) {
      return NextResponse.json(
        { ok: false, error: "Forbidden — invalid ingest key." },
        { status: 403 },
      )
    }
  }

  try {
    let sources: DocumentSource[]

    const text = await request.text()
    if (text.trim()) {
      // Single document ingestion
      const body = JSON.parse(text) as unknown
      const parsed = singleDocSchema.parse(body)
      sources = [parsed as DocumentSource]
    } else {
      // Ingest all default policy sources
      sources = POLICY_SOURCES
    }

    const results = await ingestAllDocuments(sources)

    const ingested = results.filter((r) => !r.skipped && !r.error).length
    const totalChunks = results.reduce((sum, r) => sum + r.chunkCount, 0)

    return NextResponse.json({
      ok: true,
      ingested,
      totalChunks,
      results: results.map((r) => ({
        title: r.title,
        url: r.url,
        chunkCount: r.chunkCount,
        skipped: r.skipped ?? false,
        error: r.error ?? null,
      })),
    })
  } catch (error) {
    logServerError("RAG ingest route failed", error, { route: "/api/rag/ingest" })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body.", details: error.errors },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { ok: false, error: "Ingestion failed. Check server logs for details." },
      { status: 500 },
    )
  }
}
