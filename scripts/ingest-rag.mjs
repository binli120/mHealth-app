/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

/**
 * scripts/ingest-rag.mjs
 *
 * Standalone Node.js (ESM) script to ingest MassHealth policy documents
 * into the pgvector store. Mirrors lib/rag/ingest.ts without TypeScript.
 *
 * Usage:
 *   node scripts/ingest-rag.mjs                        # Try all POLICY_SOURCES URLs
 *   node scripts/ingest-rag.mjs --sample               # Ingest built-in sample policy text (dev/test)
 *   node scripts/ingest-rag.mjs --file /path/to/doc.pdf "Doc Title" "member_booklet"
 *   node scripts/ingest-rag.mjs --url "https://..." "Doc Title" "eligibility_guide"
 *
 * Note on mass.gov: The site blocks server-side requests with 403.
 *   To ingest real policy docs, download them via your browser first,
 *   then use: node scripts/ingest-rag.mjs --file ~/Downloads/member-booklet.pdf "MassHealth Member Booklet" member_booklet
 */

import { createRequire } from "module"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { readFileSync, existsSync } from "fs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const { Pool } = require(join(__dirname, "../node_modules/pg/lib/index.js"))

// ── Config ────────────────────────────────────────────────────────────────────

const DB_URL = process.env.DATABASE_URL_DEV
  || process.env.DATABASE_URL
  || "postgresql://postgres:postgres@localhost:54322/postgres"

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "")
const EMBED_MODEL     = "nomic-embed-text"
const EMBED_DELAY_MS  = 100
const MAX_CHARS       = 1800
const OVERLAP_CHARS   = 150

// ── Sample policy data (used with --sample flag) ──────────────────────────────
// Representative excerpts distilled from MassHealth public policy documents.
// Accurate for 2024-2026 program rules. Replace with real docs for production.

const SAMPLE_SOURCES = [
  {
    title:    "MassHealth Eligibility Overview (Sample)",
    url:      "sample://eligibility-overview",
    doc_type: "eligibility_guide",
    language: "en",
    text: `
MassHealth Eligibility — Overview

MassHealth provides free or low-cost health coverage to eligible Massachusetts residents.
Eligibility depends on income, household size, age, immigration status, and disability status.

Income Limits by Program (2024, as percent of Federal Poverty Level):
- MassHealth Standard (adults 19-64): up to 133% FPL
- MassHealth CarePlus (adults 21-64): up to 133% FPL
- MassHealth CommonHealth (adults with disabilities): up to 133% FPL
- MassHealth Senior Care (65+): income and asset test apply
- ConnectorCare (Health Connector): 100%–300% FPL
- Qualified Health Plans with tax credits: up to 400% FPL

For a family of 4 in 2024, 133% FPL equals approximately $40,692 per year.
For a single adult, 133% FPL equals approximately $19,391 per year.

Residency: Applicants must be Massachusetts residents who intend to remain in Massachusetts.

Citizenship and Immigration:
- US citizens and most lawfully present immigrants are eligible for full MassHealth.
- Undocumented immigrants may qualify for limited MassHealth (emergency services only)
  and are eligible for ConnectorCare if income is within limits.

Pregnancy: Pregnant women are eligible for MassHealth Standard regardless of income.
Coverage includes prenatal care, delivery, and postpartum care for 12 months.

Children: Children up to age 18 are covered under MassHealth and CHIP (Children's
Health Insurance Program) up to 300% FPL with no waiting period.

How to Apply:
- Online: mahix.org (Health Insurance Exchange)
- Phone: 1-800-841-2900
- In-person: MassHealth Enrollment Center
    `.trim(),
  },
  {
    title:    "MassHealth Income and Household Size Guidelines (Sample)",
    url:      "sample://income-household-guidelines",
    doc_type: "eligibility_guide",
    language: "en",
    text: `
MassHealth Income Guidelines — 2024 Federal Poverty Level Table

The Federal Poverty Level (FPL) is used to determine eligibility for MassHealth programs.
Income is counted as modified adjusted gross income (MAGI) for most programs.

2024 Annual FPL Amounts:
- 1 person:  $14,580
- 2 people:  $19,720
- 3 people:  $24,860
- 4 people:  $30,000
- 5 people:  $35,140
- 6 people:  $40,280
- Each additional person: +$5,140

Program Eligibility Thresholds (annual income):
MassHealth Standard (adults 19-64): 133% FPL
  - 1 person:  $19,391
  - 2 people:  $26,228
  - 3 people:  $33,064
  - 4 people:  $39,900

MassHealth CarePlus (adults 21-64, no Medicare): 133% FPL — same as Standard

Pregnant Women: No income limit for MassHealth Standard during pregnancy.

Seniors (65+) — MassHealth Senior Care:
  - Requires both income AND asset test
  - Single: income below approximately $2,829/month; assets below $2,000
  - Married (both applying): income below approximately $5,484/month; assets below $4,000

SNAP (Supplemental Nutrition Assistance): up to 130% FPL net income
  - Gross income limit: 200% FPL (MA expanded categorical eligibility)

Household Size: Include all family members who live together and file taxes jointly,
including children, spouse, and dependents claimed on tax return.

Counting Income:
- Count wages, self-employment, Social Security, pensions, alimony
- Do NOT count: child support received, gifts, loans, Supplemental Security Income (SSI)
- Deduct: student loan interest, alimony paid, self-employment expenses
    `.trim(),
  },
  {
    title:    "MassHealth Member Booklet — Key Benefits (Sample)",
    url:      "sample://member-booklet-benefits",
    doc_type: "member_booklet",
    language: "en",
    text: `
MassHealth Member Booklet — Benefits and Coverage

What MassHealth Covers:
MassHealth provides comprehensive health coverage including:
- Primary care and specialist visits (no referral required for most plans)
- Emergency room care and hospitalization
- Prescription medications (with copays for some members)
- Mental health and substance use disorder treatment
- Dental care (varies by program; Standard includes adult dental)
- Vision care and eyeglasses
- Maternity and pregnancy care (including prenatal, delivery, postpartum)
- Preventive care (annual check-ups, immunizations, cancer screenings)
- Medically necessary equipment (wheelchairs, prosthetics)
- Home health care and personal care assistance

Prescription Drug Coverage:
Most MassHealth members have prescription drug coverage. The MassHealth drug list
(formulary) includes thousands of medications. Generic drugs usually have no copay.
Brand-name drugs may have a $1–$3.65 copay per prescription.

MassHealth CarePlus vs. Standard:
CarePlus: Managed care through a health plan. Must choose a plan. Includes most services.
Standard: Fee-for-service or managed care. More services (including dental).

Member Responsibilities:
- Show your MassHealth card at every visit
- Choose a primary care provider (PCP) if enrolled in a managed care plan
- Renew your coverage annually (during open enrollment or when contacted)
- Report changes in income, household size, or address within 10 days

Renewals:
MassHealth renews coverage annually. You will receive a renewal notice by mail.
Respond promptly to avoid a gap in coverage. If your income or household changes,
report it within 10 days to avoid overpayment or underpayment of benefits.

Complaints and Appeals:
If you disagree with a MassHealth decision, you have the right to appeal within 30 days.
Call 1-800-841-2900 or visit mass.gov/masshealth to request an appeal.
    `.trim(),
  },
  {
    title:    "MassHealth Acceptable Verifications — Required Documents (Sample)",
    url:      "sample://acceptable-verifications",
    doc_type: "verifications",
    language: "en",
    text: `
MassHealth Acceptable Verification Documents

When applying for MassHealth, you may need to provide documents to verify your information.
Many items can be verified electronically; you only need to submit documents when
electronic verification is unavailable or the data does not match.

Identity (one of the following):
- Birth certificate
- US passport or passport card
- State-issued driver's license or ID card
- School ID with photo (for children)
- Military ID

Massachusetts Residency (one of the following):
- Current utility bill (gas, electric, water) with name and MA address
- Signed lease or mortgage statement
- Recent bank statement with MA address
- Letter from a Massachusetts shelter or social service agency

Citizenship / Immigration Status:
- US Citizens: birth certificate, US passport, or naturalization certificate
- Lawful Permanent Residents: Green card (Form I-551)
- Refugees and Asylees: I-94, I-766, or asylum grant letter
- DACA recipients: Employment Authorization Document (EAD) with "C33" code

Income Verification (provide for all household members with income):
- Pay stubs (most recent 4 weeks)
- Employer letter stating wages and hours
- Social Security award letter
- Unemployment benefit letter
- Tax return (most recent, if self-employed)
- Business records (if self-employed)

Note: If you cannot provide documents, contact MassHealth. They may accept a signed
statement (attestation) for some information, including residency and household size.

Documents Not Required:
- You do NOT need to provide documents for items verified electronically
  (e.g., Social Security numbers are typically verified with SSA automatically)
- Income from jobs is verified using state wage records in many cases
    `.trim(),
  },
]

// ── Embedding ─────────────────────────────────────────────────────────────────

async function embedText(text) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Ollama embeddings failed: HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error("Ollama returned empty embedding")
  }
  return data.embedding
}

function toVectorLiteral(embedding) {
  return `[${embedding.join(",")}]`
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function embedBatch(texts, delayMs = EMBED_DELAY_MS) {
  const results = []
  for (let i = 0; i < texts.length; i++) {
    if (i % 5 === 0) process.stdout.write(`\r  Embedding chunk ${i + 1}/${texts.length}…`)
    results.push(await embedText(texts[i]))
    if (i < texts.length - 1) await sleep(delayMs)
  }
  process.stdout.write("\n")
  return results
}

// ── Text chunking ─────────────────────────────────────────────────────────────

function chunkText(text, maxChars = MAX_CHARS, overlapChars = OVERLAP_CHARS) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  if (normalized.length <= maxChars) return normalized ? [normalized] : []

  const paragraphs = normalized.split(/\n\n+/)
  const chunks = []
  let current = ""

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue
    if ((current + "\n\n" + trimmed).length <= maxChars) {
      current = current ? current + "\n\n" + trimmed : trimmed
    } else {
      if (current) {
        chunks.push(current)
        const overlap = current.slice(-overlapChars)
        current = overlap ? overlap + "\n\n" + trimmed : trimmed
      } else {
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
  return chunks.filter((c) => c.trim().length > 20)
}

// ── HTML / PDF extraction ─────────────────────────────────────────────────────

function extractTextFromHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<\/?(p|div|h[1-6]|li|tr|td|th|br|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n")
    .trim()
}

function extractTextFromPdfBuffer(buffer) {
  const raw = Buffer.from(new Uint8Array(buffer)).toString("latin1")
  const textBlocks = []
  const btEtPattern = /BT([\s\S]*?)ET/g
  let match
  while ((match = btEtPattern.exec(raw)) !== null) {
    const block = match[1]
    const stringPattern = /\(([^)]{2,200})\)/g
    let strMatch
    while ((strMatch = stringPattern.exec(block)) !== null) {
      const text = strMatch[1]
        .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, " ")
        .replace(/\\\(/g, "(").replace(/\\\)/g, ")")
        .replace(/[^\x20-\x7E\n]/g, " ").trim()
      if (text.length > 3) textBlocks.push(text)
    }
  }
  return textBlocks.join(" ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

async function fetchDocumentText(urlOrPath) {
  // Local file support
  if (urlOrPath.startsWith("/") || urlOrPath.startsWith("./") || urlOrPath.startsWith("~")) {
    const filePath = urlOrPath.replace(/^~/, process.env.HOME || "")
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`)
    const buffer = readFileSync(filePath)
    if (filePath.toLowerCase().endsWith(".pdf")) {
      return extractTextFromPdfBuffer(buffer.buffer)
    }
    return extractTextFromHtml(buffer.toString("utf-8"))
  }

  // Remote URL
  console.log(`  Fetching: ${urlOrPath}`)
  const response = await fetch(urlOrPath, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/pdf,*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(60_000),
    redirect: "follow",
  })
  if (!response.ok) {
    throw new Error(
      `Fetch failed: HTTP ${response.status}. ` +
      `Try downloading the file manually and use: node scripts/ingest-rag.mjs --file /path/to/file.pdf "Title" "doc_type"`
    )
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/pdf") || urlOrPath.endsWith("/download")) {
    const buffer = await response.arrayBuffer()
    return extractTextFromPdfBuffer(buffer)
  }
  return extractTextFromHtml(await response.text())
}

// ── Core ingestion ────────────────────────────────────────────────────────────

async function ingestOne(db, source) {
  try {
    let text
    if (source.text) {
      // Inline sample text — no fetch needed
      text = source.text
      console.log(`  Using inline text (${text.length.toLocaleString()} chars)`)
    } else {
      text = await fetchDocumentText(source.url)
      console.log(`  Extracted ${text.length.toLocaleString()} chars`)
    }

    if (!text || text.length < 100) {
      console.log(`  ⚠  Skipped (too little text)`)
      return { title: source.title, url: source.url, chunkCount: 0, skipped: true }
    }

    const chunks = chunkText(text)
    console.log(`  Split into ${chunks.length} chunks`)
    if (chunks.length === 0) {
      return { title: source.title, url: source.url, chunkCount: 0, skipped: true }
    }

    const embeddings = await embedBatch(chunks)

    // Upsert document record
    const docResult = await db.query(
      `INSERT INTO policy_documents (title, source_url, doc_type, language, ingested_at, chunk_count)
       VALUES ($1, $2, $3, $4, now(), $5)
       ON CONFLICT (source_url) DO UPDATE SET
         title       = EXCLUDED.title,
         doc_type    = EXCLUDED.doc_type,
         ingested_at = now(),
         chunk_count = EXCLUDED.chunk_count
       RETURNING id`,
      [source.title, source.url, source.doc_type, source.language ?? "en", chunks.length],
    )
    const documentId = docResult.rows[0]?.id
    if (!documentId) throw new Error("Failed to upsert policy_documents row")

    await db.query("DELETE FROM policy_chunks WHERE document_id = $1", [documentId])

    for (let i = 0; i < chunks.length; i++) {
      await db.query(
        `INSERT INTO policy_chunks (document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [documentId, i, chunks[i], toVectorLiteral(embeddings[i])],
      )
    }

    console.log(`  ✓ Inserted ${chunks.length} chunks`)
    return { title: source.title, url: source.url, chunkCount: chunks.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ ${message}`)
    return { title: source.title, url: source.url, chunkCount: 0, error: message }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  let sources

  if (args[0] === "--sample") {
    // Built-in sample policy text — instant, no HTTP fetches
    sources = SAMPLE_SOURCES
    console.log("\n📚 Mode: built-in sample data (--sample)")
  } else if (args[0] === "--file") {
    // Ingest a single local file
    const [, filePath, title = "Policy Document", doc_type = "member_booklet"] = args
    if (!filePath) { console.error("Usage: --file <path> [title] [doc_type]"); process.exit(1) }
    sources = [{ title, url: filePath, doc_type, language: "en" }]
    console.log("\n📁 Mode: local file")
  } else if (args[0] === "--url") {
    // Ingest a single URL
    const [, url, title = "Policy Document", doc_type = "eligibility_guide"] = args
    if (!url) { console.error("Usage: --url <url> [title] [doc_type]"); process.exit(1) }
    sources = [{ title, url, doc_type, language: "en" }]
    console.log("\n🌐 Mode: single URL")
  } else {
    // Try all POLICY_SOURCES (may 403 on mass.gov — use --sample for local dev)
    sources = [
      { title: "MassHealth Member Booklet", url: "https://www.mass.gov/doc/masshealth-member-booklet-2024/download", doc_type: "member_booklet", language: "en" },
      { title: "MassHealth Acceptable Verifications List", url: "https://www.mass.gov/doc/masshealth-and-health-connector-acceptable-verifications-list/download", doc_type: "verifications", language: "en" },
      { title: "MassHealth Eligibility — Under 65", url: "https://www.mass.gov/info-details/learn-if-you-are-eligible-for-a-masshealth-program-for-people-65-and-younger", doc_type: "eligibility_guide", language: "en" },
      { title: "MassHealth Eligibility — 65 and Older", url: "https://www.mass.gov/info-details/learn-if-you-are-eligible-for-a-masshealth-program-for-people-aged-65-and-older-and-people-with-certain-disabilities", doc_type: "eligibility_guide", language: "en" },
    ]
    console.log("\n🌐 Mode: all POLICY_SOURCES (tip: use --sample if mass.gov blocks requests)")
  }

  console.log(`   Documents: ${sources.length}`)
  console.log(`   DB:        ${DB_URL.replace(/:([^@]+)@/, ":***@")}`)
  console.log(`   Ollama:    ${OLLAMA_BASE_URL}\n`)

  const db = new Pool({ connectionString: DB_URL })

  try { await db.query("SELECT 1"); console.log("✓ Database connection OK") }
  catch (err) { console.error("✗ Database:", err.message); process.exit(1) }

  try {
    const testEmbed = await embedText("MassHealth test")
    console.log(`✓ Ollama ${EMBED_MODEL} OK (${testEmbed.length}-dim)\n`)
  } catch (err) {
    console.error("✗ Ollama embedding:", err.message)
    console.error("  Ensure Ollama is running and nomic-embed-text is pulled.")
    process.exit(1)
  }

  const results = []
  for (const source of sources) {
    console.log(`\n📄 ${source.title}`)
    results.push(await ingestOne(db, source))
  }

  await db.end()

  console.log("\n── Summary ────────────────────────────────────────────────────────")
  let total = 0
  for (const r of results) {
    if (r.error)        console.log(`  ✗ ${r.title}: ${r.error}`)
    else if (r.skipped) console.log(`  ⚠ ${r.title}: skipped`)
    else { console.log(`  ✓ ${r.title}: ${r.chunkCount} chunks`); total += r.chunkCount }
  }
  console.log(`\n  Total chunks ingested: ${total}`)

  if (total === 0 && results.some((r) => r.error)) {
    console.log("\n  💡 Tip: use --sample flag to ingest built-in sample data for dev/testing:")
    console.log("     node scripts/ingest-rag.mjs --sample\n")
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1) })
