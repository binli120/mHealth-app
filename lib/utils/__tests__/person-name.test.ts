/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, expect, it } from "vitest"

import { hasFirstAndLastName } from "@/lib/utils/person-name"

describe("lib/utils/person-name", () => {
  it("accepts names with first and last parts", () => {
    expect(hasFirstAndLastName("Jane Doe")).toBe(true)
    expect(hasFirstAndLastName("Jane Marie Doe")).toBe(true)
    expect(hasFirstAndLastName("Jean-Luc Picard")).toBe(true)
  })

  it("accepts unicode names", () => {
    expect(hasFirstAndLastName("José Álvarez")).toBe(true)
    expect(hasFirstAndLastName("Nguyễn Văn")).toBe(true)
  })

  it("rejects single-part and empty names", () => {
    expect(hasFirstAndLastName("Jane")).toBe(false)
    expect(hasFirstAndLastName("")).toBe(false)
    expect(hasFirstAndLastName("   ")).toBe(false)
  })
})

