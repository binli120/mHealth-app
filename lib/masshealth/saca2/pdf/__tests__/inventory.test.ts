/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { extractInventory } from "../extract"
import { getFieldInfo, getInventory } from "../inventory"
import { SACA2_TEMPLATE_PATH } from "../template"

describe("SACA-2 field inventory", () => {
  const inv = getInventory()

  it("has 1,149 uniquely named fields of the expected types", () => {
    expect(inv).toHaveLength(1149)
    expect(new Set(inv.map((f) => f.name)).size).toBe(1149)
    expect(inv.filter((f) => f.type === "text")).toHaveLength(733)
    expect(inv.filter((f) => f.type === "checkbox")).toHaveLength(414)
    expect(inv.filter((f) => f.type === "button").map((f) => f.name).sort()).toEqual(["Clear", "Print"])
  })

  it("gives every checkbox at least one widget with an on-state", () => {
    for (const f of inv.filter((x) => x.type === "checkbox")) {
      expect(f.widgets.some((w) => w.onState && w.onState !== "Off"), f.name).toBe(true)
    }
  })

  it("never records an unresolved page and keeps pages in sync with widgets", () => {
    for (const f of inv) {
      expect(f.widgets.length, f.name).toBeGreaterThan(0)
      for (const w of f.widgets) expect(w.page, f.name).toBeGreaterThanOrEqual(0)
      expect(f.pages).toEqual([...new Set(f.widgets.map((w) => w.page))])
    }
  })

  it("is sorted by first page, then top-to-bottom, then left-to-right", () => {
    for (let i = 1; i < inv.length; i++) {
      const a = inv[i - 1].widgets[0]
      const b = inv[i].widgets[0]
      if (a.page !== b.page) {
        expect(a.page).toBeLessThan(b.page)
        continue
      }
      const topA = a.rect[3]
      const topB = b.rect[3]
      if (topA !== topB) expect(topA).toBeGreaterThan(topB)
      else expect(a.rect[0]).toBeLessThanOrEqual(b.rect[0])
    }
  })

  it("equals a live extraction from the pinned template", async () => {
    const bytes = readFileSync(path.join(process.cwd(), SACA2_TEMPLATE_PATH))
    const live = await extractInventory(new Uint8Array(bytes))
    expect(live).toEqual(inv)
  })

  it("looks fields up by name", () => {
    expect(getFieldInfo("Clear")?.type).toBe("button")
    expect(getFieldInfo("no such field")).toBeUndefined()
  })
})
