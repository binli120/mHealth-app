/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import { DEFAULT_LANGUAGE } from "@/lib/i18n/languages"
import { appReducer, setLanguage } from "@/lib/redux/features/app-slice"

describe("lib/redux/features/app-slice", () => {
  it("returns initial state", () => {
    const state = appReducer(undefined, { type: "unknown" })

    expect(state).toEqual({ language: DEFAULT_LANGUAGE })
  })

  it("updates language for supported locale", () => {
    const state = appReducer({ language: "en" }, setLanguage("es"))

    expect(state.language).toBe("es")
  })
})
