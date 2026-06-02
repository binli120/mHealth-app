// lib/glossary/types.ts

export type GlossaryCategory = 'program' | 'insurance' | 'aca' | 'medical'

export type SupportedGlossaryLang = 'en' | 'es' | 'zh-CN' | 'ht' | 'pt-BR' | 'vi'

/** Full DB row */
export interface GlossaryTerm {
  id: string
  slug: string
  term_en: string
  definition_en: string
  definition_es: string | null
  definition_zh_cn: string | null
  definition_ht: string | null
  definition_pt_br: string | null
  definition_vi: string | null
  category: GlossaryCategory
  aliases: string[]
  related_slugs: string[]
  created_at: string
  updated_at: string
}

/** Lightweight record used by the client-side scanner (fetched on page load) */
export interface GlossaryIndexEntry {
  slug: string
  term_en: string
  aliases: string[]
  category: GlossaryCategory
}

export type GlossaryIndex = GlossaryIndexEntry[]

/** Output of the scanner — array of plain text or matched-term segments */
export type Segment =
  | { type: 'text'; content: string }
  | { type: 'term'; content: string; slug: string; term_en: string }
