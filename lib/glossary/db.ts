import "server-only"
import { getDbPool } from "@/lib/db/server"
import type { GlossaryTerm, GlossaryIndexEntry, GlossaryCategory, SupportedGlossaryLang } from "./types"
import { SEED_TERMS } from "./seed-terms"

const LANG_COLUMN: Record<SupportedGlossaryLang, string> = {
  en:    'definition_en',
  es:    'definition_es',
  'zh-CN': 'definition_zh_cn',
  ht:    'definition_ht',
  'pt-BR': 'definition_pt_br',
  vi:    'definition_vi',
}

export async function getAllGlossaryIndex(): Promise<GlossaryIndexEntry[]> {
  const pool = getDbPool()
  const { rows } = await pool.query<GlossaryIndexEntry>(
    `SELECT slug, term_en, aliases, category FROM glossary_terms ORDER BY term_en ASC`
  )
  return rows
}

export async function getAllGlossaryTerms(): Promise<GlossaryTerm[]> {
  const pool = getDbPool()
  const { rows } = await pool.query<GlossaryTerm>(
    `SELECT * FROM glossary_terms ORDER BY term_en ASC`
  )
  return rows
}

export async function getGlossaryTerm(slug: string): Promise<GlossaryTerm | null> {
  const pool = getDbPool()
  const { rows } = await pool.query<GlossaryTerm>(
    `SELECT * FROM glossary_terms WHERE slug = $1`,
    [slug]
  )
  return rows[0] ?? null
}

export async function upsertGlossaryTranslation(
  slug: string,
  lang: SupportedGlossaryLang,
  definition: string
): Promise<void> {
  const col = LANG_COLUMN[lang]
  const pool = getDbPool()
  await pool.query(
    `UPDATE glossary_terms SET ${col} = $1, updated_at = now() WHERE slug = $2`,
    [definition, slug]
  )
}

export async function createGlossaryTerm(input: {
  slug: string
  term_en: string
  definition_en: string
  definition_es?: string
  category: GlossaryCategory
  aliases: string[]
  related_slugs: string[]
}): Promise<GlossaryTerm> {
  const pool = getDbPool()
  const { rows } = await pool.query<GlossaryTerm>(
    `INSERT INTO glossary_terms
       (slug, term_en, definition_en, definition_es, category, aliases, related_slugs)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      input.slug,
      input.term_en,
      input.definition_en,
      input.definition_es ?? null,
      input.category,
      input.aliases,
      input.related_slugs,
    ]
  )
  return rows[0]
}

export async function updateGlossaryTerm(
  slug: string,
  updates: Partial<Pick<GlossaryTerm, 'term_en' | 'definition_en' | 'definition_es' | 'category' | 'aliases' | 'related_slugs'>>
): Promise<GlossaryTerm | null> {
  const pool = getDbPool()
  const fields = Object.keys(updates)
  if (fields.length === 0) return getGlossaryTerm(slug)
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = [slug, ...fields.map((f) => (updates as Record<string, unknown>)[f])]
  const { rows } = await pool.query<GlossaryTerm>(
    `UPDATE glossary_terms SET ${setClauses}, updated_at = now() WHERE slug = $1 RETURNING *`,
    values
  )
  return rows[0] ?? null
}

export async function deleteGlossaryTerm(slug: string): Promise<boolean> {
  const pool = getDbPool()
  const { rowCount } = await pool.query(
    `DELETE FROM glossary_terms WHERE slug = $1`,
    [slug]
  )
  return (rowCount ?? 0) > 0
}

export async function seedGlossaryTerms(): Promise<void> {
  const pool = getDbPool()
  for (const term of SEED_TERMS) {
    await pool.query(
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
  }
}
