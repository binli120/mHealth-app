/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import {
  isValidMassachusettsDriverLicense,
  parseDriverLicenseAnalysisResponse,
} from "@/lib/masshealth/driver-license-analysis-client"

describe("driver license analysis response parsing", () => {
  it("accepts an explicit valid Massachusetts driver license response", () => {
    const result = parseDriverLicenseAnalysisResponse({
      valid_ma_driver_license: true,
      issuing_state: "MA",
      document_type: "driver_license",
      confidence: 0.94,
    })

    expect(result.valid).toBe(true)
    expect(result.issuingState).toBe("MA")
    expect(result.documentType).toBe("driver_license")
    expect(result.confidence).toBe(0.94)
    expect(isValidMassachusettsDriverLicense(result)).toBe(true)
  })

  it("rejects a driver license issued by another state", () => {
    const result = parseDriverLicenseAnalysisResponse({
      valid: true,
      issuingState: "RI",
      documentType: "driver license",
    })

    expect(isValidMassachusettsDriverLicense(result)).toBe(false)
  })

  it("infers validity from nested document type and Massachusetts state", () => {
    const result = parseDriverLicenseAnalysisResponse({
      result: {
        state: "Massachusetts",
        documentType: "driver license",
      },
    })

    expect(result.valid).toBe(true)
    expect(result.issuingState).toBe("MA")
    expect(isValidMassachusettsDriverLicense(result)).toBe(true)
  })
})

