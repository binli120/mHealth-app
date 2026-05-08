/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import {
  isDriverLicenseDocument,
  isPassportDocument,
  requiresDualSideDocument,
} from "@/lib/uploads/document-requirements"

describe("document upload requirements", () => {
  it("requires front and back photos for driver license labels", () => {
    expect(requiresDualSideDocument("proof_of_identity", "MA Driver's License")).toBe(true)
    expect(requiresDualSideDocument("drivers license", null)).toBe(true)
    expect(requiresDualSideDocument("ma_driver_license", "Government ID")).toBe(true)
  })

  it("requires front and back photos for government ID variants", () => {
    expect(requiresDualSideDocument("government-id", "Government-issued photo ID")).toBe(true)
    expect(requiresDualSideDocument("state_id", "Mass ID")).toBe(true)
    expect(requiresDualSideDocument("identity", "Proof of identity")).toBe(true)
  })

  it("does not require two sides for ordinary documents", () => {
    expect(requiresDualSideDocument("paystub", "Recent pay stub")).toBe(false)
    expect(requiresDualSideDocument("utility_bill", "Utility bill")).toBe(false)
    expect(requiresDualSideDocument("passport", "US Passport")).toBe(false)
  })

  it("identifies driver licenses separately from generic IDs", () => {
    expect(isDriverLicenseDocument("proof_of_identity", "MA Driver's License")).toBe(true)
    expect(isDriverLicenseDocument("state_id", "Mass ID")).toBe(false)
  })

  it("identifies passports separately from card IDs", () => {
    expect(isPassportDocument("proof_of_citizenship", "US Passport")).toBe(true)
    expect(isPassportDocument("passport_book", null)).toBe(true)
    expect(isPassportDocument("driver_license", "MA Driver's License")).toBe(false)
  })
})
