/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"

import { nearestLabel, parseBboxPages, parseBboxWords, type BboxWord } from "../field-context"

const XHTML = `<doc>
<page width="612.000000" height="792.000000"><flow><block><line>
<word xMin="36.0" yMin="35.5" xMax="60.25" yMax="47.5">Tom&amp;Jerry</word>
<word xMin="65" yMin="35.5" xMax="90" yMax="47.5">&lt;ok&gt;</word>
</line></block></flow></page>
<page width="600" height="700"><flow><block><line>
<word xMin="10" yMin="20" xMax="30" yMax="32">Page2</word>
</line></block></flow></page>
</doc>`

/** Builds a word in top-left coordinates, 10pt tall. */
const w = (text: string, x1: number, top: number, x2: number): BboxWord => ({
  text,
  x1,
  y1: top,
  x2,
  y2: top + 10,
})

describe("parseBboxPages / parseBboxWords", () => {
  it("parses pages, sizes and words, decoding entities", () => {
    const pages = parseBboxPages(XHTML)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toMatchObject({ width: 612, height: 792 })
    expect(pages[0].words.map((x) => x.text)).toEqual(["Tom&Jerry", "<ok>"])
    expect(pages[0].words[0]).toEqual({ text: "Tom&Jerry", x1: 36, y1: 35.5, x2: 60.25, y2: 47.5 })
    expect(pages[1]).toMatchObject({ width: 600, height: 700 })
    expect(pages[1].words).toHaveLength(1)
  })

  it("flattens all words across pages", () => {
    expect(parseBboxWords(XHTML).map((x) => x.text)).toEqual(["Tom&Jerry", "<ok>", "Page2"])
  })
})

describe("nearestLabel", () => {
  const H = 800
  // Field at top-left y=100..112 => pdf-lib rect y1 = 800-112 = 688, y2 = 700.
  const rect: [number, number, number, number] = [200, 688, 260, 700]

  it("prefers the left neighbour on the same line over a word above", () => {
    const words = [w("Above", 190, 80, 215), w("SSN", 150, 101, 180), w("Social", 100, 101, 145)]
    const r = nearestLabel(rect, H, words)
    expect(r.left).toBe("Social SSN")
    expect(r.label).toBe("Social SSN")
  })

  it("falls back to the line above when nothing is on the left", () => {
    const words = [w("Name", 150, 85, 190), w("Line2", 200, 70, 240)]
    const r = nearestLabel(rect, H, words)
    expect(r.left).toBe("")
    expect(r.above[0]).toBe("Name")
    expect(r.label).toBe("Name")
  })

  it("returns the right neighbour for a checkbox and honours prefer", () => {
    const box: [number, number, number, number] = [100, 688, 110, 698]
    const words = [w("Male", 116, 101, 140), w("Sex", 40, 101, 80)]
    const r = nearestLabel(box, H, words, { prefer: "right" })
    expect(r.right).toBe("Male")
    expect(r.label).toBe("Male")
    expect(nearestLabel(box, H, words).label).toBe("Sex")
  })

  it("flips y correctly (top-left text vs bottom-left rect)", () => {
    // Correct flip puts the field at top 100..112. A wrongly unflipped rect would
    // sit at top ~688, near "Wrong". "Right" shares the correct line.
    const words = [w("Right", 150, 101, 190), w("Wrong", 150, 690, 190)]
    expect(nearestLabel(rect, H, words).left).toBe("Right")
  })

  it("ignores words beyond the maximum distance", () => {
    const words = [w("Far", 0, 101, 20), w("FarAbove", 200, 10, 240)]
    const r = nearestLabel(rect, H, words, { maxDistance: 50 })
    expect(r.left).toBe("")
    expect(r.above).toEqual([])
    expect(r.label).toBe("")
  })

  it("returns an empty label when there is no text at all", () => {
    expect(nearestLabel(rect, H, [])).toEqual({ left: "", right: "", above: [], label: "" })
  })
})
