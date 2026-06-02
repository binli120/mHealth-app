import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import type { SupportedGlossaryLang } from "./types"
import { logServerError } from "@/lib/server/logger"

const LANGUAGE_NAMES: Record<SupportedGlossaryLang, string> = {
  en:      'English',
  es:      'Spanish',
  'zh-CN': 'Simplified Chinese',
  ht:      'Haitian Creole',
  'pt-BR': 'Brazilian Portuguese',
  vi:      'Vietnamese',
}

export async function generateTranslation(
  slug: string,
  termEn: string,
  definitionEn: string,
  lang: SupportedGlossaryLang
): Promise<string | null> {
  try {
    const client = new Anthropic()
    const langName = LANGUAGE_NAMES[lang]
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Translate the following health insurance term definition into ${langName}. Return ONLY the translated definition text — no preamble, no labels, no quotes.\n\nTerm: ${termEn}\nEnglish definition: ${definitionEn}`,
        },
      ],
    })
    const block = message.content[0]
    if (block.type !== "text") return null
    return block.text.trim()
  } catch (err) {
    logServerError(`glossary translate [${slug}/${lang}]`, err)
    return null
  }
}
