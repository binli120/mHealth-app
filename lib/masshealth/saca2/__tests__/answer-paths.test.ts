/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getAtPath, parsePath, setAtPath } from "@/lib/masshealth/saca2/answer-paths"

describe("parsePath", () => {
  it("turns digit segments into numbers", () => {
    expect(parsePath("persons.0.firstName")).toEqual(["persons", 0, "firstName"])
  })

  it("rejects prototype-pollution segments", () => {
    expect(() => parsePath("__proto__.polluted")).toThrow(/forbidden/i)
    expect(() => parsePath("persons.constructor.prototype")).toThrow(/forbidden/i)
    expect(() => parsePath("a.prototype")).toThrow(/forbidden/i)
  })
})

describe("getAtPath", () => {
  const root = { persons: [{ firstName: "Ada", income: [{ amount: 5 }] }], intake: { programs: { longTermCare: true } } }

  it("reads nested objects and array indices", () => {
    expect(getAtPath(root, "persons.0.firstName")).toBe("Ada")
    expect(getAtPath(root, "persons.0.income.0.amount")).toBe(5)
    expect(getAtPath(root, "intake.programs.longTermCare")).toBe(true)
  })

  it("returns undefined for missing or non-object steps", () => {
    expect(getAtPath(root, "persons.3.firstName")).toBeUndefined()
    expect(getAtPath(root, "intake.programs.longTermCare.deeper")).toBeUndefined()
    expect(getAtPath(null, "a.b")).toBeUndefined()
  })
})

describe("setAtPath", () => {
  it("does not mutate the original and shares untouched branches", () => {
    const root = { a: { x: 1 }, b: { y: 2 } }
    const next = setAtPath(root, "a.x", 9)
    expect(root.a.x).toBe(1)
    expect(next.a.x).toBe(9)
    expect(next.b).toBe(root.b)
  })

  it("updates array elements without mutating the source array", () => {
    const root = { persons: [{ firstName: "A" }, { firstName: "B" }] }
    const next = setAtPath(root, "persons.1.firstName", "Z")
    expect(root.persons[1].firstName).toBe("B")
    expect(next.persons[1].firstName).toBe("Z")
    expect(next.persons[0]).toBe(root.persons[0])
  })

  it("creates missing containers: arrays for numeric segments, objects otherwise", () => {
    const next = setAtPath({} as Record<string, unknown>, "persons.0.income.1.amount", 3)
    expect(next).toEqual({ persons: [{ income: [undefined, { amount: 3 }] }] })
    expect(Array.isArray((next as { persons: unknown }).persons)).toBe(true)
  })

  it("can replace a whole array value", () => {
    const next = setAtPath({ persons: [{ income: [] as unknown[] }] }, "persons.0.income", [{ amount: 1 }])
    expect(next.persons[0].income).toEqual([{ amount: 1 }])
  })

  it("rejects forbidden segments and empty paths and never pollutes Object.prototype", () => {
    expect(() => setAtPath({}, "__proto__.polluted", true)).toThrow(/forbidden/i)
    expect(() => setAtPath({}, "", 1)).toThrow(/empty path/i)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
