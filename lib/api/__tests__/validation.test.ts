/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  emailSchema,
  parseJsonBody,
  parseParams,
  parseQuery,
  passwordSchema,
  uuidSchema,
} from "@/lib/api/validation"

const bodySchema = z.object({ name: z.string().min(1) })

function makeJsonRequest(body: unknown): Request {
  return new Request("http://test/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeRawRequest(raw: string): Request {
  return new Request("http://test/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  })
}

describe("parseJsonBody", () => {
  it("returns data on a valid body", async () => {
    const result = await parseJsonBody(makeJsonRequest({ name: "Jane" }), bodySchema)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual({ name: "Jane" })
  })

  it("returns a 400 response for malformed JSON", async () => {
    const result = await parseJsonBody(makeRawRequest("{not json"), bodySchema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(400)
      const json = await result.response.json()
      expect(json.ok).toBe(false)
    }
  })

  it("returns a 400 response for a schema violation", async () => {
    const result = await parseJsonBody(makeJsonRequest({ name: "" }), bodySchema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(400)
    }
  })
})

describe("parseQuery", () => {
  const querySchema = z.object({ limit: z.coerce.number().int().positive().optional() })

  it("returns data for valid params", () => {
    const result = parseQuery(new URLSearchParams("limit=10"), querySchema)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual({ limit: 10 })
  })

  it("returns a 400 response for invalid params", () => {
    const result = parseQuery(new URLSearchParams("limit=-1"), querySchema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })
})

describe("parseParams", () => {
  const paramsSchema = z.object({ applicationId: uuidSchema })

  it("returns data for a valid UUID param", () => {
    const result = parseParams(
      { applicationId: "11111111-1111-4111-8111-111111111111" },
      paramsSchema,
    )
    expect(result.ok).toBe(true)
  })

  it("returns a 400 response for a non-UUID param", () => {
    const result = parseParams({ applicationId: "not-a-uuid" }, paramsSchema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })
})

describe("emailSchema", () => {
  it("trims and lowercases valid emails", () => {
    expect(emailSchema.parse("  User@Example.com  ")).toBe("user@example.com")
  })

  it("rejects invalid emails", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false)
  })
})

describe("passwordSchema", () => {
  it("accepts an 8+ character password", () => {
    expect(passwordSchema.parse("longenough")).toBe("longenough")
  })

  it("rejects a short password", () => {
    const result = passwordSchema.safeParse("short")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe("Password must be at least 8 characters.")
    }
  })

  it("rejects a missing password with the same message", () => {
    const result = passwordSchema.safeParse(undefined)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe("Password must be at least 8 characters.")
    }
  })
})
