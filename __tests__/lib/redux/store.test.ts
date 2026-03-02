import { describe, expect, it } from "vitest"

import { setLanguage } from "@/lib/redux/features/app-slice"
import { makeStore } from "@/lib/redux/store"

describe("lib/redux/store", () => {
  it("creates store with default app state", () => {
    const store = makeStore()

    expect(store.getState().app.language).toBe("en")
  })

  it("applies app language updates", () => {
    const store = makeStore()

    store.dispatch(setLanguage("vi"))

    expect(store.getState().app.language).toBe("vi")
  })
})
