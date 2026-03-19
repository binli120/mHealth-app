/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, expect, it } from "vitest"

import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, isSupportedLanguage } from "@/lib/i18n/languages"

describe("lib/i18n/languages", () => {
  it("uses English as default language", () => {
    expect(DEFAULT_LANGUAGE).toBe("en")
  })

  it("includes all supported languages", () => {
    const codes = SUPPORTED_LANGUAGES.map((language) => language.code)

    expect(codes).toEqual(["en", "zh-CN", "ht", "pt-BR", "es", "vi"])
  })

  it("validates supported language codes", () => {
    expect(isSupportedLanguage("en")).toBe(true)
    expect(isSupportedLanguage("pt-BR")).toBe(true)
    expect(isSupportedLanguage("fr")).toBe(false)
  })
})
