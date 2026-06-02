/**
 * One-time script to seed glossary_terms from seed-terms.ts into the cloud DB.
 * Run: npx tsx scripts/seed-glossary.ts
 */
import { Pool } from "pg"
import { SEED_TERMS } from "../lib/glossary/seed-terms"

async function main() {
  const connectionString =
    process.env.DATABASE_URL_DEV || process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL not set")

  const pool = new Pool({ connectionString })

  let inserted = 0
  let skipped = 0

  for (const term of SEED_TERMS) {
    const result = await pool.query(
      `INSERT INTO glossary_terms
         (slug, term_en, definition_en, definition_es, category, aliases, related_slugs)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (slug) DO NOTHING`,
      [
        term.slug,
        term.term_en,
        term.definition_en,
        term.definition_es,
        term.category,
        term.aliases,
        term.related_slugs,
      ]
    )
    if ((result.rowCount ?? 0) > 0) {
      inserted++
      console.log(`  ✓ ${term.slug}`)
    } else {
      skipped++
      console.log(`  — ${term.slug} (already exists)`)
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
