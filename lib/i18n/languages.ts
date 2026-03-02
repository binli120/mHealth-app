export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
  { code: "ht", label: "Kreyòl ayisyen" },
  { code: "pt-BR", label: "Português, Brasil" },
  { code: "es", label: "Español" },
  { code: "vi", label: "Tiếng Việt" },
] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"]

export const DEFAULT_LANGUAGE: SupportedLanguage = "en"

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((language) => language.code === value)
}
