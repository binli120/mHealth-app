/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { completeRichHousehold } from "../../__tests__/complete-answers"
import { extractInventory } from "../extract"
import { getInventory } from "../inventory"
import { fillSaca2Pdf } from "../pdf-fill"
import { splitSharedFields, SHARED_FIELD_SUFFIX } from "../split-shared-fields"
import { loadSaca2Template } from "../template"
import { readFilled } from "./helpers/read-filled"

const ON = new Date("2026-10-13T12:00:00Z")

const SHARED = [
  "Contribution to self-employed SEP, SIMPLE, and qualified plans: Yearly amount $",
  "Deductible part of self-employment tax: Yearly amount $",
  "Health Savings Account deduction: Yearly amount $",
  "Individual Retirement Account (IRA) deduction: Yearly amount $",
  "Moving expenses for members of the Armed Forces: Yearly amount $",
  "Penalty on early withdrawal of savings: Yearly amount $",
  "Self-employed health insurance deduction: Yearly amount $",
  "Student loan deduction (interest only, not total payment): Yearly amount $",
]

async function widgetPages(doc: PDFDocument): Promise<Map<string, number[]>> {
  const refs = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i]))
  return new Map(
    doc.getForm().getFields().map((f) => [
      f.getName(),
      f.acroField.getWidgets().map((w) => refs.get(w.P()!.toString()) ?? -1),
    ]),
  )
}

describe("splitSharedFields", () => {
  it("gives each shared deduction field a Person 2 copy with the page-12 widget and nothing else changes", async () => {
    const bytes = await loadSaca2Template()
    const before = await widgetPages(await PDFDocument.load(bytes))
    const doc = await PDFDocument.load(bytes)
    splitSharedFields(doc)
    const after = await widgetPages(doc)

    expect(after.size).toBe(before.size + 8)
    for (const name of SHARED) {
      const copy = after.get(name + SHARED_FIELD_SUFFIX)
      expect(copy, name).toEqual([12])
      expect(after.get(name)!.includes(12), name).toBe(false)
      expect(after.get(name), name).toEqual(before.get(name)!.filter((p) => p !== 12))
    }
    for (const [name, pages] of before) if (!SHARED.includes(name)) expect(after.get(name), name).toEqual(pages)
  })

  it("is idempotent", async () => {
    const doc = await PDFDocument.load(await loadSaca2Template())
    splitSharedFields(doc)
    const once = (await widgetPages(doc)).size
    splitSharedFields(doc)
    expect((await widgetPages(doc)).size).toBe(once)
  })

  it("finds no other text field that straddles Person 1's and Person 2's pages (the eight are the whole set)", async () => {
    const before = await widgetPages(await PDFDocument.load(await loadSaca2Template()))
    const straddling = [...before].filter(([, p]) => p.some((x) => x <= 8) && p.some((x) => x >= 9 && x <= 12)).map(([n]) => n)
    expect(straddling.sort()).toEqual([...SHARED].sort())
  })

  it("keeps the committed inventory in step: 1,157 fields, the copies on page 12 only", () => {
    const inv = getInventory()
    expect(inv).toHaveLength(1157)
    for (const name of SHARED) {
      expect(inv.find((f) => f.name === name + SHARED_FIELD_SUFFIX)?.pages).toEqual([12])
      expect(inv.find((f) => f.name === name)?.pages).not.toContain(12)
    }
  })

  it("survives a save and reload with the same inventory and the new fields", async () => {
    const doc = await PDFDocument.load(await loadSaca2Template())
    splitSharedFields(doc)
    const saved = await doc.save()
    const reloaded = await extractInventory(saved)
    expect(reloaded).toEqual(getInventory())
    expect(reloaded.filter((f) => f.name.endsWith(SHARED_FIELD_SUFFIX))).toHaveLength(8)
  })

  it("a filled form shows Person 1's deduction amounts only on Person 1's fields, never on page 12", async () => {
    const a = completeRichHousehold()
    expect(a.persons[0].deductions.amounts.hsa).toBe(1500)
    const bytes = await fillSaca2Pdf(a, null, ON)
    const { text } = await readFilled(bytes)
    expect(text[SHARED[2]]).toBe("1500")
    expect(text[SHARED[7]]).toBe("600")
    for (const name of SHARED) expect(text, name).not.toHaveProperty([name + SHARED_FIELD_SUFFIX])
    const doc = await PDFDocument.load(bytes)
    const pages = await widgetPages(doc)
    expect(pages.get(SHARED[2])).not.toContain(12)
  })
})
