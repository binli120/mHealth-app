import { beforeEach, describe, expect, it, vi } from "vitest"

const query = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({ query }),
}))

import { assertCustomerRole } from "@/lib/db/personal-data-reset"

beforeEach(() => vi.clearAllMocks())

describe("assertCustomerRole", () => {
  it("allows a legacy customer account without an explicit applicant role", async () => {
    query.mockResolvedValue({ rows: [{ allowed: true }] })
    await expect(assertCustomerRole("user-id")).resolves.toBe(true)
    expect(query.mock.calls[0][0]).toMatch(/EXISTS \(SELECT 1 FROM public\.users/)
    expect(query.mock.calls[0][0]).toMatch(/NOT EXISTS/)
  })

  it("rejects accounts classified as staff", async () => {
    query.mockResolvedValue({ rows: [{ allowed: false }] })
    await expect(assertCustomerRole("staff-id")).resolves.toBe(false)
  })
})
