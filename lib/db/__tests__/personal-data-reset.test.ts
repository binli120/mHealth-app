import { beforeEach, describe, expect, it, vi } from "vitest"

const query = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({ query }),
}))

import { assertCustomerRole, hasCustomerPersonalData } from "@/lib/db/personal-data-reset"

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

describe("hasCustomerPersonalData", () => {
  it("reports whether meaningful customer-entered data exists", async () => {
    query.mockResolvedValue({ rows: [{ has_personal_data: true }] })

    await expect(hasCustomerPersonalData("user-id")).resolves.toBe(true)
    const sql = String(query.mock.calls[0][0])
    expect(sql).toMatch(/SELECT 1 FROM public\.applicants WHERE user_id = \$1::uuid/)
    expect(sql).toMatch(/to_jsonb\(u\)->>'avatar_url'/)
  })

  it("returns false for an empty account and excludes automatic activity tables", async () => {
    query.mockResolvedValue({ rows: [{ has_personal_data: false }] })

    await expect(hasCustomerPersonalData("user-id")).resolves.toBe(false)
    const sql = String(query.mock.calls[0][0])
    expect(sql).not.toMatch(/notifications|login_events|analytics|rate_limit_counters/)
  })
})
