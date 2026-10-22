/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"

import { isCheckboxEncoder } from "../encoders"
import { FIELD_MAP } from "../field-map"
import { getFieldInfo, getInventory } from "../inventory"
import { NEVER_FILL } from "../never-fill"
import type { FieldEntry } from "../types"
import { computeUnmappedFields } from "../unmapped"
import unmappedJson from "../unmapped-fields.json"

/** Integrity problems of a map against the template inventory (empty when sound). */
function mapProblems(map: FieldEntry[]): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const entry of map) {
    const checkbox = isCheckboxEncoder(entry.encode)
    if (checkbox && entry.fields.length !== 1) problems.push(`checkbox entry must have one field: ${entry.fields[0]}`)
    if (typeof entry.encode === "object" && entry.encode.kind === "ssn" && entry.fields.length !== 9) {
      problems.push(`ssn entry must have nine fields: ${entry.fields[0]}`)
    }
    for (const name of entry.fields) {
      if (seen.has(name)) problems.push(`mapped twice: ${name}`)
      seen.add(name)
      const info = getFieldInfo(name)
      if (!info) {
        problems.push(`not in template: ${name}`)
        continue
      }
      if (checkbox) {
        if (info.type !== "checkbox") {
          problems.push(`checkbox encoder on a ${info.type} field: ${name}`)
          continue
        }
        const states = new Set(info.widgets.map((w) => w.onState))
        const enc = entry.encode
        const wanted =
          enc.kind === "check" ? ["On"] : enc.kind === "yesNo" ? [enc.yes, enc.no] : Object.values(enc.states)
        for (const state of wanted) if (!states.has(state)) problems.push(`state "${state}" not on field: ${name}`)
      } else if (info.type !== "text") {
        problems.push(`text encoder on a ${info.type} field: ${name}`)
      }
    }
  }
  return problems
}

describe("coverage ratchet", () => {
  it("unmapped-fields.json equals inventory minus mapped fields minus NEVER_FILL, sorted", () => {
    expect(unmappedJson).toEqual(computeUnmappedFields(FIELD_MAP))
    expect([...unmappedJson].sort()).toEqual(unmappedJson)
  })

  it("accounts for every field exactly once: unmapped + mapped + never-fill = inventory", () => {
    const mapped = FIELD_MAP.flatMap((e) => e.fields)
    const total = unmappedJson.length + mapped.length + Object.keys(NEVER_FILL).length
    expect(total).toBe(getInventory().length)
  })

  it("the FIELD_MAP is sound against the template", () => {
    expect(mapProblems(FIELD_MAP)).toEqual([])
  })

  it("never-fill keys exist in the template, carry a reason, and are not also mapped", () => {
    const mapped = new Set(FIELD_MAP.flatMap((e) => e.fields))
    for (const [name, entry] of Object.entries(NEVER_FILL)) {
      expect(getFieldInfo(name), name).toBeDefined()
      expect(entry.reason, name).toBeTruthy()
      expect(mapped.has(name), `${name} is both mapped and never-fill`).toBe(false)
    }
    expect(Object.keys(NEVER_FILL)).toEqual(expect.arrayContaining(["Clear", "Print"]))
  })

  it("is closed: every inventory field is mapped or deliberately never filled", () => {
    expect(unmappedJson).toEqual([])
    expect(computeUnmappedFields(FIELD_MAP)).toEqual([])
  })

  it("every never-fill entry has an allowed reason, and a non-empty note when the reason is other", () => {
    const allowed = ["button", "signature", "signature-date", "consent", "office-use", "voter", "other"]
    for (const [name, entry] of Object.entries(NEVER_FILL)) {
      expect(allowed, `${name}: reason`).toContain(entry.reason)
      if (entry.reason === "other") expect((entry.note ?? "").trim().length, `${name}: note`).toBeGreaterThan(0)
    }
  })
})

describe("map integrity checker (proves the checks bite)", () => {
  const ok = (): FieldEntry => ({
    fields: ["12 City"],
    source: { kind: "answer", stepId: "person1", path: "city" },
    encode: "text",
  })

  it("accepts a sound map", () => {
    expect(mapProblems([ok()])).toEqual([])
    expect(
      mapProblems([
        {
          fields: ["4 Are you applying for health or dental coverage for YOURSELF?"],
          source: { kind: "answer", stepId: "person1", path: "applyingForCoverage" },
          encode: { kind: "yesNo", yes: "1", no: "2" },
        },
      ]),
    ).toEqual([])
  })

  it("flags missing fields, duplicates, and wrong types", () => {
    expect(mapProblems([{ ...ok(), fields: ["Nope"] }])).toEqual(["not in template: Nope"])
    expect(mapProblems([ok(), ok()])).toEqual(["mapped twice: 12 City"])
    expect(mapProblems([{ ...ok(), fields: ["Are you legally married?"] }])[0]).toMatch(/text encoder on a checkbox/)
    expect(mapProblems([{ ...ok(), encode: { kind: "yesNo", yes: "1", no: "2" } }])[0]).toMatch(/checkbox encoder on a text/)
  })

  it("flags on-states the field does not have, and wrong SSN box counts", () => {
    const yesNo = (yes: string, no: string): FieldEntry => ({
      fields: ["Are you legally married?"],
      source: { kind: "answer", stepId: "person1", path: "isLegallyMarried" },
      encode: { kind: "yesNo", yes, no },
    })
    expect(mapProblems([yesNo("Yes", "No")])).toEqual([
      'state "Yes" not on field: Are you legally married?',
      'state "No" not on field: Are you legally married?',
    ])
    expect(mapProblems([{ ...ok(), fields: ["10. SSN1"], encode: { kind: "ssn" } }])[0]).toMatch(/nine fields/)
    expect(
      mapProblems([
        {
          fields: ["Are you legally married?"],
          source: { kind: "answer", stepId: "person1", path: "isLegallyMarried" },
          encode: { kind: "pick", states: { yes: "1", no: "9" } },
        },
      ]),
    ).toEqual(['state "9" not on field: Are you legally married?'])
  })
})
