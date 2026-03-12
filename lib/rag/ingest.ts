import "server-only"

import { getDbPool } from "@/lib/db/server"
import { embedBatch, toVectorLiteral } from "./embed"

// ── Document source definitions ───────────────────────────────────────────────

export interface DocumentSource {
  title: string
  url: string
  doc_type: "member_booklet" | "eligibility_guide" | "verifications" | "transmittal" | "faq"
  language: string
}

/**
 * Priority MassHealth policy documents to ingest.
 * All are publicly accessible Massachusetts state government pages / PDFs.
 */
export const POLICY_SOURCES: DocumentSource[] = [
  {
    title: "MassHealth Member Booklet",
    url: "https://www.mass.gov/doc/masshealth-member-booklet-2024/download",
    doc_type: "member_booklet",
    language: "en",
  },
  {
    title: "MassHealth and Health Connector Acceptable Verifications List",
    url: "https://www.mass.gov/doc/masshealth-and-health-connector-acceptable-verifications-list/download",
    doc_type: "verifications",
    language: "en",
  },
  {
    title: "MassHealth Eligibility — People 65 and Younger",
    url: "https://www.mass.gov/info-details/learn-if-you-are-eligible-for-a-masshealth-program-for-people-65-and-younger",
    doc_type: "eligibility_guide",
    language: "en",
  },
  {
    title: "MassHealth Eligibility — People 65 and Older",
    url: "https://www.mass.gov/info-details/learn-if-you-are-eligible-for-a-masshealth-program-for-people-aged-65-and-older-and-people-with-certain-disabilities",
    doc_type: "eligibility_guide",
    language: "en",
  },
]

// ── Text chunking ─────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks suitable for embedding.
 * Strategy: paragraph-first (double newline), then sentence-level splitting
 * if a paragraph is too long. Overlap ensures context continuity.
 */
export function chunkText(
  text: string,
  maxChars = 1800,
  overlapChars = 150,
): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()

  if (normalized.length <= maxChars) {
    return normalized ? [normalized] : []
  }

  const paragraphs = normalized.split(/\n\n+/)
  const chunks: string[] = []
  let current = ""

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    if ((current + "\n\n" + trimmed).length <= maxChars) {
      current = current ? current + "\n\n" + trimmed : trimmed
    } else {
      // Save current chunk if non-empty
      if (current) {
        chunks.push(current)
        // Carry overlap: last overlapChars of the current chunk into next
        const overlap = current.slice(-overlapChars)
        current = overlap ? overlap + "\n\n" + trimmed : trimmed
      } else {
        // Single paragraph exceeds maxChars — split by sentences
        const sentences = trimmed.match(/[^.!?]+[.!?]+/g) ?? [trimmed]
        let sentChunk = ""
        for (const sentence of sentences) {
          if ((sentChunk + " " + sentence).length <= maxChars) {
            sentChunk = sentChunk ? sentChunk + " " + sentence : sentence
          } else {
            if (sentChunk) chunks.push(sentChunk)
            sentChunk = sentence.slice(0, maxChars)
          }
        }
        if (sentChunk) current = sentChunk
      }
    }
  }

  if (current) chunks.push(current)

  return chunks.filter((c) => c.trim().length > 20)  // filter trivially short chunks
}

// ── HTML / PDF text extraction ────────────────────────────────────────────────

/**
 * Fetch a URL and extract its plain text content.
 * Handles HTML pages (strips tags) and PDFs (basic text extraction).
 */
export async function fetchDocumentText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "MassHealth-RAG-Ingest/1.0 (+https://mass.gov)",
      Accept: "text/html,application/pdf,*/*",
    },
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  }

  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/pdf") || url.endsWith("/download")) {
    // PDF: read as buffer, extract text using basic heuristic
    // (pdf-lib doesn't expose text extraction; we use a simple regex approach
    //  to pull readable ASCII strings from the PDF binary stream)
    const buffer = await response.arrayBuffer()
    return extractTextFromPdfBuffer(buffer)
  }

  // HTML: strip tags
  const html = await response.text()
  return extractTextFromHtml(html)
}

function extractTextFromHtml(html: string): string {
  return html
    // Remove scripts, styles, nav, header, footer (noisy)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    // Replace block elements with newlines for paragraph detection
    .replace(/<\/?(p|div|h[1-6]|li|tr|td|th|br|section|article)[^>]*>/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function extractTextFromPdfBuffer(buffer: ArrayBuffer): string {
  // Extract printable ASCII strings from PDF binary (simple heuristic).
  // Good enough for government policy PDFs that embed readable text streams.
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder("latin1")
  const raw = decoder.decode(bytes)

  // Extract text from PDF stream objects (between BT...ET markers)
  const textBlocks: string[] = []
  const btEtPattern = /BT([\s\S]*?)ET/g
  let match: RegExpExecArray | null

  while ((match = btEtPattern.exec(raw)) !== null) {
    const block = match[1]
    // Pull string literals: (text) and <hex>
    const stringPattern = /\(([^)]{2,200})\)/g
    let strMatch: RegExpExecArray | null
    while ((strMatch = stringPattern.exec(block)) !== null) {
      const text = strMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\t/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        // Filter out binary-looking content
        .replace(/[^\x20-\x7E\n]/g, " ")
        .trim()
      if (text.length > 3) textBlocks.push(text)
    }
  }

  return textBlocks
    .join(" ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// ── Ingestion pipeline ────────────────────────────────────────────────────────

export interface IngestResult {
  title: string
  url: string
  chunkCount: number
  skipped?: boolean
  error?: string
}

/**
 * Ingest a single policy document: fetch → chunk → embed → upsert.
 * Idempotent: deletes existing chunks for this document before inserting new ones.
 */
export async function ingestDocument(source: DocumentSource): Promise<IngestResult> {
  const db = getDbPool()

  try {
    // 1. Fetch and extract text
    const text = await fetchDocumentText(source.url)
    if (!text || text.length < 100) {
      return { title: source.title, url: source.url, chunkCount: 0, skipped: true }
    }

    // 2. Chunk
    const chunks = chunkText(text)
    if (chunks.length === 0) {
      return { title: source.title, url: source.url, chunkCount: 0, skipped: true }
    }

    // 3. Embed (sequential to avoid overloading local Ollama)
    const embeddings = await embedBatch(chunks, 100)

    // 4. Upsert document record (idempotent by source_url)
    const docResult = await db.query<{ id: string }>(
      `INSERT INTO policy_documents (title, source_url, doc_type, language, ingested_at, chunk_count)
       VALUES ($1, $2, $3, $4, now(), $5)
       ON CONFLICT (source_url) DO UPDATE SET
         title       = EXCLUDED.title,
         doc_type    = EXCLUDED.doc_type,
         ingested_at = now(),
         chunk_count = EXCLUDED.chunk_count
       RETURNING id`,
      [source.title, source.url, source.doc_type, source.language, chunks.length],
    )

    const documentId = docResult.rows[0]?.id
    if (!documentId) throw new Error("Failed to upsert policy_documents row")

    // 5. Delete old chunks for this document (re-ingestion flow)
    await db.query(`DELETE FROM policy_chunks WHERE document_id = $1`, [documentId])

    // 6. Insert new chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      await db.query(
        `INSERT INTO policy_chunks (document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [documentId, i, chunks[i], toVectorLiteral(embeddings[i])],
      )
    }

    return { title: source.title, url: source.url, chunkCount: chunks.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { title: source.title, url: source.url, chunkCount: 0, error: message }
  }
}

/**
 * Ingest all POLICY_SOURCES (or a custom list).
 * Returns per-document results.
 */
export async function ingestAllDocuments(
  sources: DocumentSource[] = POLICY_SOURCES,
): Promise<IngestResult[]> {
  const results: IngestResult[] = []

  for (const source of sources) {
    const result = await ingestDocument(source)
    results.push(result)
  }

  return results
}
