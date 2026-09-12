import { expect, it } from "vitest"
import { parseAamvaBarcode } from "../aamva-parser"

function payload(firstField: string) {
  const dl = `DL${firstField}\nDACJANE\nDBB01011990\nDBA01012030\nDAG123 TEST ST\nDAICONCORD\nDAJNH\nDAK033010000\r`
  return `@\n\x1e\rANSI 636039090001DL0031${String(dl.length).padStart(4, "0")}${dl}`
}

it("extracts the surname when the DL subfile starts immediately after the header", () => {
  const result = parseAamvaBarcode(payload("DCSDOE"))
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.data).toMatchObject({ lastName: "DOE", firstName: "JANE", issuingState: "NH" })
})

it("extracts the document number from the first DL field", () => {
  const result = parseAamvaBarcode(payload("DAQSYNTHETIC\nDCSDOE"))
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.data.licenseNumber).toBe("SYNTHETIC")
})
