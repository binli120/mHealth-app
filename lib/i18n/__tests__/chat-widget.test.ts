/**
 * Exhaustive unit tests for lib/i18n/chat-widget.ts.
 *
 * Coverage goals:
 *   1. Every key is present and non-empty for all 6 supported locales.
 *   2. Specific known translations are spot-checked per locale.
 *   3. Non-English locales do not accidentally fall back to English for
 *      keys that should be translated.
 *   4. getChatWidgetCopy falls back to English for an unknown locale.
 *   5. CHAT_WIDGET_ALL_KEYS matches the full set of copy keys.
 *   6. All 6 locales are covered (regression against missing catalog entry).
 *
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect } from "vitest"

import {
  getChatWidgetCopy,
  CHAT_WIDGET_ALL_KEYS,
  type ChatWidgetCopy,
  type ChatWidgetCopyKey,
} from "@/lib/i18n/chat-widget"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALL_LOCALES = SUPPORTED_LANGUAGES.map((l) => l.code) as SupportedLanguage[]

// ── 1. Every key present & non-empty for every locale ─────────────────────────

describe("exhaustive key coverage", () => {
  it.each(ALL_LOCALES)("locale '%s' has every key non-empty", (locale) => {
    const copy = getChatWidgetCopy(locale)

    for (const key of CHAT_WIDGET_ALL_KEYS) {
      const value = copy[key]
      expect(value, `[${locale}] key '${key}' is missing or empty`).toBeTruthy()
      expect(typeof value, `[${locale}] key '${key}' should be a string`).toBe("string")
      expect(value.trim().length, `[${locale}] key '${key}' should not be blank`).toBeGreaterThan(0)
    }
  })
})

// ── 2. Spot-checks: English baseline ──────────────────────────────────────────

describe("English baseline strings", () => {
  const en = getChatWidgetCopy("en")

  it("has correct openAssistant", () => {
    expect(en.openAssistant).toBe("Open MassHealth assistant")
  })

  it("has correct title", () => {
    expect(en.title).toBe("MassHealth AI Assistant")
  })

  it("has correct advisorTab", () => {
    expect(en.advisorTab).toBe("Benefit Advisor")
  })

  it("has correct faqTab", () => {
    expect(en.faqTab).toBe("Common Questions")
  })

  it("has correct chatTab", () => {
    expect(en.chatTab).toBe("Chat")
  })

  it("has correct send", () => {
    expect(en.send).toBe("Send")
  })

  it("has correct close", () => {
    expect(en.close).toBe("Close")
  })

  it("has correct thinking", () => {
    expect(en.thinking).toBe("Thinking…")
  })

  it("includes MassHealth phone number in fallbackReply", () => {
    expect(en.fallbackReply).toContain("(800) 841-2900")
  })

  it("mentions Ollama in serviceUnavailable", () => {
    expect(en.serviceUnavailable).toContain("Ollama")
  })
})

// ── 3. Spot-checks: Simplified Chinese (zh-CN) ────────────────────────────────

describe("zh-CN translations", () => {
  const zhCN = getChatWidgetCopy("zh-CN")

  it("translates title", () => {
    expect(zhCN.title).toBe("MassHealth AI 助手")
  })

  it("translates close", () => {
    expect(zhCN.close).toBe("关闭")
  })

  it("translates send", () => {
    expect(zhCN.send).toBe("发送")
  })

  it("translates reset", () => {
    expect(zhCN.reset).toBe("重置")
  })

  it("translates thinking", () => {
    expect(zhCN.thinking).toBe("正在思考…")
  })

  it("translates advisorTab", () => {
    expect(zhCN.advisorTab).toBe("福利顾问")
  })

  it("does NOT use English title", () => {
    expect(zhCN.title).not.toBe("MassHealth AI Assistant")
  })
})

// ── 4. Spot-checks: Haitian Creole (ht) ──────────────────────────────────────

describe("ht translations", () => {
  const ht = getChatWidgetCopy("ht")

  it("translates close", () => {
    expect(ht.close).toBe("Fèmen")
  })

  it("translates send", () => {
    expect(ht.send).toBe("Voye")
  })

  it("translates advisorTab", () => {
    expect(ht.advisorTab).toBe("Konseye Benefis")
  })

  it("translates reset", () => {
    expect(ht.reset).toBe("Rekòmanse")
  })

  it("translates thinking", () => {
    expect(ht.thinking).toBe("Ap reflechi…")
  })

  it("includes MassHealth phone number in fallbackReply", () => {
    expect(ht.fallbackReply).toContain("(800) 841-2900")
  })
})

// ── 5. Spot-checks: Brazilian Portuguese (pt-BR) ──────────────────────────────

describe("pt-BR translations", () => {
  const ptBR = getChatWidgetCopy("pt-BR")

  it("translates title", () => {
    expect(ptBR.title).toBe("Assistente de IA do MassHealth")
  })

  it("translates close", () => {
    expect(ptBR.close).toBe("Fechar")
  })

  it("translates send", () => {
    expect(ptBR.send).toBe("Enviar")
  })

  it("translates faqTab", () => {
    expect(ptBR.faqTab).toBe("Perguntas Frequentes")
  })

  it("translates thinking", () => {
    expect(ptBR.thinking).toBe("Pensando…")
  })

  it("does NOT use English title", () => {
    expect(ptBR.title).not.toBe("MassHealth AI Assistant")
  })
})

// ── 6. Spot-checks: Spanish (es) ─────────────────────────────────────────────

describe("es translations", () => {
  const es = getChatWidgetCopy("es")

  it("translates title", () => {
    expect(es.title).toBe("Asistente de IA de MassHealth")
  })

  it("translates close", () => {
    expect(es.close).toBe("Cerrar")
  })

  it("translates send", () => {
    expect(es.send).toBe("Enviar")
  })

  it("translates reset", () => {
    expect(es.reset).toBe("Restablecer")
  })

  it("translates advisorTab", () => {
    expect(es.advisorTab).toBe("Asesor de Beneficios")
  })

  it("translates thinking", () => {
    expect(es.thinking).toBe("Pensando…")
  })

  it("does NOT use English title", () => {
    expect(es.title).not.toBe("MassHealth AI Assistant")
  })
})

// ── 7. Spot-checks: Vietnamese (vi) ──────────────────────────────────────────

describe("vi translations", () => {
  const vi = getChatWidgetCopy("vi")

  it("translates title", () => {
    expect(vi.title).toBe("Trợ lý AI MassHealth")
  })

  it("translates close", () => {
    expect(vi.close).toBe("Đóng")
  })

  it("translates send", () => {
    expect(vi.send).toBe("Gửi")
  })

  it("translates advisorTab", () => {
    expect(vi.advisorTab).toBe("Tư Vấn Phúc Lợi")
  })

  it("translates thinking", () => {
    expect(vi.thinking).toBe("Đang suy nghĩ…")
  })

  it("translates faqTab", () => {
    expect(vi.faqTab).toBe("Câu Hỏi Thường Gặp")
  })

  it("does NOT use English title", () => {
    expect(vi.title).not.toBe("MassHealth AI Assistant")
  })
})

// ── 8. Non-English locales differ from English for key translated fields ───────

describe("non-English locales diverge from English baseline", () => {
  const en = getChatWidgetCopy("en")

  const LOCALES_AND_FIELDS: [SupportedLanguage, ChatWidgetCopyKey][] = [
    ["zh-CN", "title"],
    ["zh-CN", "close"],
    ["zh-CN", "send"],
    ["ht",    "close"],
    ["ht",    "send"],
    ["pt-BR", "title"],
    ["pt-BR", "close"],
    ["es",    "title"],
    ["es",    "close"],
    ["vi",    "title"],
    ["vi",    "close"],
  ]

  it.each(LOCALES_AND_FIELDS)(
    "locale '%s' key '%s' is not the same as English",
    (locale, key) => {
      const copy = getChatWidgetCopy(locale)
      expect(copy[key]).not.toBe(en[key])
    },
  )
})

// ── 9. English fallback for unknown locale ────────────────────────────────────

describe("getChatWidgetCopy fallback", () => {
  it("falls back to English for an unrecognised locale", () => {
    // Cast to force a non-SupportedLanguage value through at runtime
    const copy = getChatWidgetCopy("xx" as SupportedLanguage)
    expect(copy.title).toBe("MassHealth AI Assistant")
    expect(copy.send).toBe("Send")
  })
})

// ── 10. CHAT_WIDGET_ALL_KEYS completeness ─────────────────────────────────────

describe("CHAT_WIDGET_ALL_KEYS", () => {
  it("contains at least 22 keys", () => {
    expect(CHAT_WIDGET_ALL_KEYS.length).toBeGreaterThanOrEqual(22)
  })

  it("contains every key present on the English copy object", () => {
    const en = getChatWidgetCopy("en")
    const enKeys = Object.keys(en) as ChatWidgetCopyKey[]
    for (const key of enKeys) {
      expect(CHAT_WIDGET_ALL_KEYS).toContain(key)
    }
  })

  it("contains known key names", () => {
    const expected: ChatWidgetCopyKey[] = [
      "openAssistant",
      "hideAssistant",
      "title",
      "close",
      "send",
      "thinking",
      "fallbackReply",
      "serviceUnavailable",
      "advisorTab",
      "faqTab",
      "chatTab",
      "reset",
    ]
    for (const key of expected) {
      expect(CHAT_WIDGET_ALL_KEYS).toContain(key)
    }
  })
})

// ── 11. All SUPPORTED_LANGUAGES have a catalog entry ──────────────────────────

describe("catalog completeness", () => {
  it("returns a fully-typed copy object (no undefined keys) for every supported locale", () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      const copy = getChatWidgetCopy(code as SupportedLanguage)
      // Every key from the English baseline must exist in the returned copy
      for (const key of CHAT_WIDGET_ALL_KEYS) {
        expect(
          copy[key],
          `[${code}] key '${key}' should not be undefined`,
        ).toBeDefined()
      }
    }
  })
})
