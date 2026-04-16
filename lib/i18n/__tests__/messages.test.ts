/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import { getMessage } from "@/lib/i18n/messages"

describe("lib/i18n/messages", () => {
  it("returns English messages for English locale", () => {
    expect(getMessage("en", "heroTitle")).toBe("Health Coverage for Every Massachusetts Resident")
  })

  it("returns translated messages for supported locales", () => {
    expect(getMessage("es", "signIn")).toBe("Iniciar sesión")
    expect(getMessage("zh-CN", "signIn")).toBe("登录")
    expect(getMessage("ht", "navPrograms")).toBe("Pwogram")
    expect(getMessage("pt-BR", "language")).toBe("Idioma")
    expect(getMessage("vi", "status")).toBe("Trạng thái")
  })
})
