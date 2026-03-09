import { describe, expect, it } from "vitest"

import { parsePastedUsAddress } from "@/lib/utils/address-parse"

describe("lib/utils/address-parse", () => {
  it("parses street, city, state, zip format", () => {
    expect(parsePastedUsAddress("123 Main St, Boston, MA 02108")).toEqual({
      streetAddress: "123 Main St",
      city: "Boston",
      state: "MA",
      zipCode: "02108",
    })
  })

  it("normalizes zip+4 and uppercase state", () => {
    expect(parsePastedUsAddress("500 market st, San Francisco, ca 94105-1234")).toEqual({
      streetAddress: "500 market st",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
    })
  })

  it("supports optional country suffix", () => {
    expect(parsePastedUsAddress("1 Main St, Cambridge, MA 02139, USA")).toEqual({
      streetAddress: "1 Main St",
      city: "Cambridge",
      state: "MA",
      zipCode: "02139",
    })
  })

  it("returns null for unsupported formats", () => {
    expect(parsePastedUsAddress("1 Main St Boston MA 02139")).toBeNull()
    expect(parsePastedUsAddress("just text")).toBeNull()
  })
})
