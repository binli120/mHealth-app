/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import { parseDriverLicenseBarcode } from "@/lib/utils/aamva"

describe("lib/utils/aamva", () => {
  it("parses core personal fields from AAMVA barcode text", () => {
    const barcode = `@
ANSI 636026080102DL00410288ZA03290015DL
DCSDOE
DACJANE
DBB19870704
DAG123 MAIN ST
DAIBOSTON
DAJMA
DAK021080000`

    expect(parseDriverLicenseBarcode(barcode)).toEqual({
      firstName: "JANE",
      lastName: "DOE",
      dob: "1987-07-04",
      address: "123 MAIN ST",
      city: "BOSTON",
      state: "MA",
      zip: "02108",
    })
  })

  it("parses mmddyyyy dob format and DL-prefixed fields", () => {
    const barcode = `DLDCSPUBLIC
DLDACJOHN
DLDBB01151980
DLDAG500 ATLANTIC AVE
DLDAIBOSTON
DLDAJMA
DLDAK021100123`

    expect(parseDriverLicenseBarcode(barcode)).toEqual({
      firstName: "JOHN",
      lastName: "PUBLIC",
      dob: "1980-01-15",
      address: "500 ATLANTIC AVE",
      city: "BOSTON",
      state: "MA",
      zip: "02110",
    })
  })

  it("returns null when data cannot be parsed", () => {
    expect(parseDriverLicenseBarcode("not a barcode payload")).toBeNull()
    expect(parseDriverLicenseBarcode("")).toBeNull()
  })
})
