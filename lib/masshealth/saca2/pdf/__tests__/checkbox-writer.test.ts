/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFCheckBox, PDFDocument, PDFName } from "pdf-lib"
import { beforeAll, describe, expect, it } from "vitest"

import { applyCheckboxState, setCheckboxState } from "../checkbox-writer"
import { getInventory } from "../inventory"
import { loadSaca2Template } from "../template"

const YES_NO = "Do you own or have a legal interest in your primary residence?"
const REVERSED_NUMERIC = "4 Are you applying for health or dental coverage for YOURSELF?"
const REVERSED_YES_NO = "Do you or your spouse own any life insurance?"
const FOUR_STATE = "7. Are you of Hispanic or Latino origin or descent?"
const SCRAMBLED_FOUR = "Type of ownership (Check one.)"

const OFF = PDFName.of("Off")

let template: Uint8Array

beforeAll(async () => {
  template = await loadSaca2Template()
})

function widgetStates(doc: PDFDocument, name: string) {
  const field = doc.getForm().getCheckBox(name)
  const v = field.acroField.dict.lookup(PDFName.of("V"))
  return {
    v: v instanceof PDFName && v !== OFF ? v.decodeText() : null,
    widgets: field.acroField.getWidgets().map((w) => ({
      on: w.getOnValue()?.decodeText(),
      as: w.getAppearanceState()?.decodeText() ?? null,
    })),
  }
}

async function roundTrip(name: string, state: string | null) {
  const doc = await PDFDocument.load(template)
  setCheckboxState(doc.getForm(), name, state)
  const reloaded = await PDFDocument.load(await doc.save())
  return widgetStates(reloaded, name)
}

describe("setCheckboxState on real groups", () => {
  it("the chosen groups really have the expected on-state order in the template", () => {
    const order = (name: string) =>
      getInventory()
        .find((f) => f.name === name)!
        .widgets.map((w) => w.onState)
    expect(order(YES_NO)).toEqual(["Yes", "No"])
    expect(order(REVERSED_NUMERIC)).toEqual(["2", "1"])
    expect(order(REVERSED_YES_NO)).toEqual(["No", "Yes"])
    expect(order(FOUR_STATE)).toEqual(["1", "2", "3", "4"])
    expect(order(SCRAMBLED_FOUR)).toEqual(["1", "3", "2", "4"])
  })

  for (const name of [YES_NO, REVERSED_NUMERIC, REVERSED_YES_NO, FOUR_STATE, SCRAMBLED_FOUR]) {
    it(`selects each state on its own widget and clears the others, also after save and reload: ${name}`, async () => {
      const doc = await PDFDocument.load(template)
      const states = widgetStates(doc, name).widgets.map((w) => w.on!)
      for (const state of states) {
        setCheckboxState(doc.getForm(), name, state)
        const result = widgetStates(doc, name)
        expect(result.v, `${name} -> ${state}`).toBe(state)
        expect(result.widgets.map((w) => w.as)).toEqual(states.map((s) => (s === state ? state : "Off")))
        expect(result.widgets.map((w) => w.on)).toEqual(states) // appearance dictionaries untouched
      }
      // the last state survives a save and reload
      const last = states[states.length - 1]
      const reloaded = widgetStates(await PDFDocument.load(await doc.save()), name)
      expect(reloaded.v).toBe(last)
      expect(reloaded.widgets.map((w) => w.as)).toEqual(states.map((s) => (s === last ? last : "Off")))
    })
  }

  it("selects the second state on the widget in the second position, not the first (reversed group)", async () => {
    // widgets are [/2, /1]; asking for /1 must tick the SECOND widget
    const result = await roundTrip(REVERSED_NUMERIC, "1")
    expect(result.v).toBe("1")
    expect(result.widgets).toEqual([
      { on: "2", as: "Off" },
      { on: "1", as: "1" },
    ])
  })

  it("clears every widget with null, after a state was set", async () => {
    const doc = await PDFDocument.load(template)
    const form = doc.getForm()
    setCheckboxState(form, FOUR_STATE, "3")
    setCheckboxState(form, FOUR_STATE, null)
    const reloaded = await PDFDocument.load(await doc.save())
    const result = widgetStates(reloaded, FOUR_STATE)
    expect(result.v).toBeNull()
    expect(result.widgets.every((w) => w.as === "Off")).toBe(true)
  })

  it("sets a single /On checkbox", async () => {
    const single = getInventory().find((f) => f.type === "checkbox" && f.widgets.length === 1 && f.widgets[0].onState === "On")!
    const on = await roundTrip(single.name, "On")
    expect(on.v).toBe("On")
    expect(on.widgets).toEqual([{ on: "On", as: "On" }])
    expect((await roundTrip(single.name, null)).v).toBeNull()
  })

  it("throws for a state the field does not have, naming the field and the allowed states", async () => {
    const doc = await PDFDocument.load(template)
    const act = () => setCheckboxState(doc.getForm(), REVERSED_NUMERIC, "Yes")
    expect(act).toThrow(REVERSED_NUMERIC)
    expect(act).toThrow(/2, 1/)
    // and leaves the field untouched
    const { v, widgets } = widgetStates(doc, REVERSED_NUMERIC)
    expect(v).toBeNull()
    expect(widgets.every((w) => w.as === "Off")).toBe(true)
  })

  it("throws for a missing field and for a text field, naming only the field", async () => {
    const doc = await PDFDocument.load(template)
    expect(() => setCheckboxState(doc.getForm(), "No Such Box", "On")).toThrow(/No Such Box/)
    expect(() => setCheckboxState(doc.getForm(), "You", "On")).toThrow(/You/)
  })

  it("works for every state of every checkbox in the template", async () => {
    const doc = await PDFDocument.load(template)
    // index once: a by-name lookup walks every field and would make this sweep slow
    const byName = new Map(doc.getForm().getFields().map((f) => [f.getName(), f]))
    for (const info of getInventory().filter((f) => f.type === "checkbox")) {
      const field = byName.get(info.name) as PDFCheckBox
      const expectedStates = info.widgets.map((w) => w.onState!)
      for (const state of [...new Set(expectedStates), null]) {
        applyCheckboxState(field, info.name, state)
        const v = field.acroField.dict.lookup(PDFName.of("V"))
        expect(v instanceof PDFName && v !== OFF ? v.decodeText() : null, info.name).toBe(state)
        const widgets = field.acroField.getWidgets()
        // a state shared by several widgets ticks all of them
        expect(widgets.map((w) => w.getAppearanceState()?.decodeText())).toEqual(
          expectedStates.map((s) => (s === state ? state : "Off")),
        )
      }
    }
  })
})
