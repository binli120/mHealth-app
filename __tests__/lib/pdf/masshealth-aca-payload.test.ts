import { describe, expect, it } from "vitest"

import { massHealthAcaPayloadSchema } from "@/lib/pdf/masshealth-aca-payload"

describe("lib/pdf/masshealth-aca-payload", () => {
  it("applies schema defaults", () => {
    const parsed = massHealthAcaPayloadSchema.parse({
      firstName: "Jane",
      lastName: "Doe",
    })

    expect(parsed.state).toBe("MA")
    expect(parsed.householdSize).toBe(1)
    expect(parsed.city).toBe("")
    expect(parsed.streetAddress).toBe("")
  })

  it("rejects invalid payload", () => {
    const result = massHealthAcaPayloadSchema.safeParse({ firstName: "Jane" })

    expect(result.success).toBe(false)
  })
})
