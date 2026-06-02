import { NextRequest, NextResponse } from "next/server"
import { getGlossaryTerm, upsertGlossaryTranslation } from "@/lib/glossary/db"
import { generateTranslation } from "@/lib/glossary/translate"
import type { SupportedGlossaryLang, GlossaryTerm } from "@/lib/glossary/types"
import { logServerError } from "@/lib/server/logger"

const VALID_LANGS = new Set<string>(["en", "es", "zh-CN", "ht", "pt-BR", "vi"])

const LANG_TO_COLUMN: Record<SupportedGlossaryLang, keyof GlossaryTerm> = {
  en:      "definition_en",
  es:      "definition_es",
  "zh-CN": "definition_zh_cn",
  ht:      "definition_ht",
  "pt-BR": "definition_pt_br",
  vi:      "definition_vi",
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  try {
    const term = await getGlossaryTerm(slug)
    if (!term) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    const lang = (request.nextUrl.searchParams.get("lang") ?? "en") as SupportedGlossaryLang
    const safeLang: SupportedGlossaryLang = VALID_LANGS.has(lang) ? lang : "en"

    const col = LANG_TO_COLUMN[safeLang]
    let definition = term[col] as string | null

    if (!definition && safeLang !== "en") {
      definition = await generateTranslation(term.slug, term.term_en, term.definition_en, safeLang)
      if (definition) {
        await upsertGlossaryTranslation(term.slug, safeLang, definition)
      }
    }

    return NextResponse.json({
      slug: term.slug,
      term_en: term.term_en,
      definition: definition ?? term.definition_en,
      category: term.category,
      related_slugs: term.related_slugs,
    })
  } catch (err) {
    logServerError(`GET /api/glossary/${slug}`, err)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
