/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFDocument, PDFName } from "pdf-lib"
import { beforeAll, describe, expect, it } from "vitest"

import { completeRichHousehold, completeSingleSenior } from "../../__tests__/complete-answers"
import { getInventory } from "../inventory"
import { collectFillValues, fillSaca2Pdf } from "../pdf-fill"
import { loadSaca2Template } from "../template"
import type { FieldEntry } from "../types"
import { readFilled } from "./helpers/read-filled"

const ON = new Date("2026-10-13T12:00:00Z")
const SSN_BOXES = Array.from({ length: 9 }, (_, i) => `10. SSN${i + 1}`)

const MAP: FieldEntry[] = [
  { fields: ["12 City"], source: { kind: "answer", stepId: "person1", path: "city" }, encode: "text" },
  { fields: SSN_BOXES, source: { kind: "answer", stepId: "person1", path: "ssn" }, encode: { kind: "ssn" } },
  { fields: ["15 County"], source: { kind: "answer", stepId: "person1", path: "dateOfBirth" }, encode: "date" },
  {
    fields: ["Are you legally married?"],
    source: { kind: "answer", stepId: "person1", path: "isLegallyMarried" },
    encode: { kind: "yesNo", yes: "1", no: "2" },
  },
  {
    fields: ["4 Are you applying for health or dental coverage for YOURSELF?"], // widget order /2 ; /1
    source: { kind: "answer", stepId: "person1", path: "applyingForCoverage" },
    encode: { kind: "yesNo", yes: "1", no: "2" },
  },
]

let template: Uint8Array

beforeAll(async () => {
  template = await loadSaca2Template()
})

describe("collectFillValues", () => {
  it("collects text, spread SSN digits and checkbox states from visible answers", () => {
    const items = collectFillValues(completeRichHousehold(), ON, MAP)
    const byField = Object.fromEntries(items.map((i) => [i.field, i.value]))
    expect(byField["12 City"]).toBe("Testville")
    expect(SSN_BOXES.map((f) => byField[f])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"])
    expect(byField["15 County"]).toBe("06/15/1985")
    expect(byField["Are you legally married?"]).toEqual({ state: "1" })
    expect(byField["4 Are you applying for health or dental coverage for YOURSELF?"]).toEqual({ state: "1" })
  })

  it("omits a stale SSN once its gate is closed (and writes it while open)", () => {
    const a = completeRichHousehold()
    expect(collectFillValues(a, ON, MAP).filter((i) => i.field.startsWith("10. SSN"))).toHaveLength(9)
    a.persons[0].hasSsn = "no"
    expect(collectFillValues(a, ON, MAP).filter((i) => i.field.startsWith("10. SSN"))).toHaveLength(0)
  })

  it("maps 'no' answers to the no state", () => {
    const items = collectFillValues(completeSingleSenior(), ON, MAP)
    const byField = Object.fromEntries(items.map((i) => [i.field, i.value]))
    expect(byField["Are you legally married?"]).toEqual({ state: "2" })
    expect(SSN_BOXES.some((f) => f in byField)).toBe(false) // hasSsn "no": nothing written
  })

  it("is empty for an empty field map", () => {
    expect(collectFillValues(completeRichHousehold(), ON, [])).toEqual([])
  })

  it("resolves derived sources through the registry and rejects unknown ids", () => {
    const entry: FieldEntry = { fields: ["12 City"], source: { kind: "derived", id: "p1.city" }, encode: "text" }
    const derived = { "p1.city": () => "Derived City" }
    expect(collectFillValues(completeSingleSenior(), ON, [entry], derived)).toEqual([
      { field: "12 City", value: "Derived City" },
    ])
    expect(() => collectFillValues(completeSingleSenior(), ON, [entry])).toThrow(/p1\.city/)
  })

  it("repeats one value into every field of an entry", () => {
    const entry: FieldEntry = {
      fields: ["12 City", "9. If yes facility name"],
      source: { kind: "answer", stepId: "person1", path: "city" },
      encode: "text",
    }
    expect(collectFillValues(completeSingleSenior(), ON, [entry]).map((i) => i.field)).toEqual([
      "12 City",
      "9. If yes facility name",
    ])
  })

  it("rejects a field listed twice", () => {
    const entry = (): FieldEntry => ({
      fields: ["12 City"],
      source: { kind: "answer", stepId: "person1", path: "city" },
      encode: "text",
    })
    expect(() => collectFillValues(completeSingleSenior(), ON, [entry(), entry()])).toThrow(/12 City/)
  })
})

describe("fillSaca2Pdf", () => {
  it("fills text, SSN, date and Yes/No and reads back exactly", async () => {
    const bytes = await fillSaca2Pdf(completeRichHousehold(), template, ON, MAP)
    const { text, checks } = await readFilled(bytes)
    expect(text["12 City"]).toBe("Testville")
    expect(SSN_BOXES.map((f) => text[f]).join("")).toBe("123456789")
    expect(text["15 County"]).toBe("06/15/1985")
    expect(checks["Are you legally married?"]).toBe("1")
    expect(checks["4 Are you applying for health or dental coverage for YOURSELF?"]).toBe("1")
    // nothing else was touched
    expect(Object.keys(text).sort()).toEqual(["12 City", "15 County", ...SSN_BOXES].sort())
    expect(Object.entries(checks).filter(([, v]) => v !== null).map(([k]) => k).sort()).toEqual([
      "4 Are you applying for health or dental coverage for YOURSELF?",
      "Are you legally married?",
    ])
  })

  it("leaves hidden (stale) answers blank in the output", async () => {
    const a = completeRichHousehold()
    a.persons[0].hasSsn = "no"
    const { text } = await readFilled(await fillSaca2Pdf(a, template, ON, MAP))
    expect(SSN_BOXES.some((f) => f in text)).toBe(false)
    expect(text["12 City"]).toBe("Testville")
  })

  it("writes the 'no' state on the right widget of a reversed group", async () => {
    const a = completeRichHousehold()
    a.persons[0].applyingForCoverage = "no"
    const { checks } = await readFilled(await fillSaca2Pdf(a, template, ON, MAP))
    expect(checks["4 Are you applying for health or dental coverage for YOURSELF?"]).toBe("2")
  })

  it("keeps the form editable: the 1,157 fields (1,149 plus the eight Person 2 copies), original names, not flattened", async () => {
    const bytes = await fillSaca2Pdf(completeRichHousehold(), template, ON, MAP)
    const names = (await PDFDocument.load(bytes)).getForm().getFields().map((f) => f.getName())
    expect(names).toHaveLength(1157)
    expect([...names].sort()).toEqual(getInventory().map((f) => f.name).sort())
  })

  it("clears the template's phantom /V (a value naming no widget state) in the output", async () => {
    const name = "2b. Does this person have a Medigap/Medicare supplemental policy?"
    const raw = async (bytes: Uint8Array) =>
      (await PDFDocument.load(bytes)).getForm().getCheckBox(name).acroField.dict.lookup(PDFName.of("V"))
    expect(await raw(template)).toBe(PDFName.of("On")) // the quirk exists in the pinned template
    const out = await fillSaca2Pdf(completeRichHousehold(), template, ON, MAP)
    expect(await raw(out)).toBe(PDFName.of("Off"))
  })

  it("loads the pinned template when no bytes are given", async () => {
    const { text } = await readFilled(await fillSaca2Pdf(completeRichHousehold(), null, ON, MAP))
    expect(text["12 City"]).toBe("Testville")
  })

  it("throws for a mapped field that is not in the template, naming only the field", async () => {
    const bad: FieldEntry[] = [
      { fields: ["No Such Field"], source: { kind: "answer", stepId: "person1", path: "firstName" }, encode: "text" },
    ]
    const err = await fillSaca2Pdf(completeRichHousehold(), template, ON, bad).catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toContain("No Such Field")
    expect((err as Error).message).not.toContain("Maria")
  })

  it("throws when an encoder does not suit the field type, naming only the field", async () => {
    const textToCheckbox: FieldEntry[] = [
      { fields: ["Are you legally married?"], source: { kind: "answer", stepId: "person1", path: "firstName" }, encode: "text" },
    ]
    await expect(fillSaca2Pdf(completeRichHousehold(), template, ON, textToCheckbox)).rejects.toThrow(/Are you legally married/)
    const checkToText: FieldEntry[] = [
      { fields: ["12 City"], source: { kind: "answer", stepId: "person1", path: "isLegallyMarried" }, encode: { kind: "yesNo", yes: "1", no: "2" } },
    ]
    await expect(fillSaca2Pdf(completeRichHousehold(), template, ON, checkToText)).rejects.toThrow(/12 City/)
  })

  it("throws for a value longer than the field's maximum length, without echoing the value", async () => {
    const tooLong: FieldEntry[] = [
      { fields: ["13 State"], source: { kind: "answer", stepId: "person1", path: "streetAddress" }, encode: "text" },
    ]
    const a = completeRichHousehold()
    const err = (await fillSaca2Pdf(a, template, ON, tooLong).catch((e: Error) => e)) as Error
    expect(err.message).toContain("13 State")
    expect(err.message).not.toContain(a.persons[0].streetAddress)
  })

  it("fills non-Latin text without throwing and replaces only the unrenderable characters", async () => {
    const a = completeRichHousehold()
    a.persons[0].city = "Zoë 李"
    const { text } = await readFilled(await fillSaca2Pdf(a, template, ON, MAP))
    expect(text["12 City"]).toBe("Zoë ?")
  })

  it("rejects a stray ssn entry that does not have nine boxes", async () => {
    const bad: FieldEntry[] = [
      { fields: SSN_BOXES.slice(0, 8), source: { kind: "answer", stepId: "person1", path: "ssn" }, encode: { kind: "ssn" } },
    ]
    await expect(fillSaca2Pdf(completeRichHousehold(), template, ON, bad)).rejects.toThrow(/9 fields/)
  })
})
