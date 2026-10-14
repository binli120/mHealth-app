/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const query = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({ query }),
}))

import { upsertApplicationDraft } from "@/lib/db/application-drafts"

const USER_ID = "07d7e11d-6a3d-41a8-826d-66e38470c830"
const APPLICANT_ID = "11111111-1111-4111-8111-111111111111"
const APPLICATION_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"

const DRAFT_ROW = {
  id: APPLICATION_ID,
  status: "draft",
  application_type: "saca2",
  draft_state: {},
  draft_step: 2,
  last_saved_at: "2026-10-13T00:00:00.000Z",
  submitted_at: null,
  created_at: "2026-10-13T00:00:00.000Z",
  updated_at: "2026-10-13T00:00:00.000Z",
  phi_draft_resume_id: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ id: APPLICANT_ID }] })
    .mockResolvedValueOnce({ rows: [DRAFT_ROW] })
})

describe("upsertApplicationDraft PHI stripping", () => {
  it("removes every SACA-2 PHI key from the persisted draft_state but keeps server-safe keys", async () => {
    await upsertApplicationDraft({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      applicationType: "saca2",
      wizardState: {
        schemaVersion: "saca2-2026-08",
        currentStep: 2,
        data: {
          intake: { programs: { longTermCare: true } },
          signature: { signedBy: "applicant" },
          screening: { commonHealthTenYears: "yes" },
          persons: [{ firstName: "Ada", ssn: "123456789" }],
          aian: { anyMember: "yes" },
          previousMedicalBills: { hasBills: "yes" },
          assets: { bankAccounts: [{ accountNumber: "9999" }] },
          transfers: [{ amount: 1 }],
          health: { employerOfferedCoverage: "yes" },
          pca: { needsPca: "yes" },
          supplements: { a: {} },
        },
      },
    })

    const call = query.mock.calls.find((c) => /INSERT INTO public\.applications \(/.test(String(c[0])))
    const saved = JSON.parse(String((call?.[1] as unknown[])[4])) as { data: Record<string, unknown> }
    expect(Object.keys(saved.data).sort()).toEqual(["intake", "signature"])
    expect(JSON.stringify(saved)).not.toMatch(/Ada|123456789|9999/)
  })
})
