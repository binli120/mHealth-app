/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { PHI_DATA_KEYS, PHI_DATA_KEY_SET } from "@/lib/phi-token/phi-fields"
import { SACA2_PHI_KEYS, SACA2_SERVER_SAFE_KEYS } from "@/lib/masshealth/saca2/types"

describe("PHI_DATA_KEYS", () => {
  it("keeps the original ACA-3 keys", () => {
    for (const key of ["contact", "preApp", "persons"]) {
      expect(PHI_DATA_KEY_SET.has(key)).toBe(true)
    }
  })

  it("covers every SACA-2 PHI key", () => {
    for (const key of SACA2_PHI_KEYS) {
      expect(PHI_DATA_KEY_SET.has(key)).toBe(true)
    }
  })

  it("never classifies a server-safe SACA-2 key as PHI", () => {
    for (const key of SACA2_SERVER_SAFE_KEYS) {
      expect(PHI_DATA_KEY_SET.has(key)).toBe(false)
    }
  })

  it("does not claim ACA-3 non-PHI data keys", () => {
    for (const key of ["assister", "assisterEnabled", "attestation"]) {
      expect(PHI_DATA_KEY_SET.has(key)).toBe(false)
    }
  })

  it("has no duplicates", () => {
    expect(new Set(PHI_DATA_KEYS).size).toBe(PHI_DATA_KEYS.length)
  })
})
